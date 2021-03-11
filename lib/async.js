const fasync = { };

fasync.dpc = (delay, fn)=>{
	if(typeof delay == 'function')
		return setTimeout(delay, fn||0);
	return setTimeout(fn, delay||0);
}

fasync.clearDPC = (dpc_)=>{
	clearTimeout(dpc_);
}

/**
* debounce provided function for given time
* @param {String} name key name to debounce function
* @param {Number} time time in milliseconds for delay
* @param {Function} fn a function to debounce
* @return {Object} a reference to debounced function
* @since 0.0.1
*/
fasync._debounce = new Map();
fasync.debounce = (name, time, fn)=>{
	if(typeof time == 'function'){
		let _fn = fn;
		fn = time;
		time = _fn;
	}
	
	if(fasync._debounce.has(name))
		fasync._debounce.get(name).cancel();

	fasync._debounce.set(name, {
		id:setTimeout(fn, time),
		cancel(){
			if(!this.id){
				clearTimeout(this.id)
				this.id = null;
			}

		}
	})

	return fasync._debounce.get(name);
}

fasync.Semaphore = class Semaphore extends Promise {
	constructor(name) {
		// needed for MyPromise.race/all ecc
		if(name instanceof Function){
			return super(name)
		}

		let resolve, reject;

		super((resolve_, reject_) => {
			resolve = resolve_;
			reject = reject_;
			// setTimeout(() => {
			//     resolve(1)
			// }, 1000)
		})

		this.resolve = resolve;
		this.reject = reject;
		this.name = name
	}

	// you can also use Symbol.species in order to
	// return a Promise for then/catch/finally
	static get [Symbol.species]() {
		return Promise;
	}

	// Promise overrides his Symbol.toStringTag
	get [Symbol.toStringTag]() {
		return 'Semaphore';
	}
}

fasync.timeout = (ms, reason = 'timeout') => {
    let methods;
    let timer;
    const p = new Promise((resolve, reject) => {
        let cancel = () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
        methods = { cancel };
        timer = setTimeout(() => {
            reject(reason);
        }, ms);
    });
    // noinspection JSUnusedAssignment
    return Object.assign(p, methods);
}

fasync.delay = (ms = 0, value) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, ms);
    });
}

const deferred = fasync.deferred = () => {
    let methods = {};
    const p = new Promise((resolve, reject) => {
        methods = { resolve, reject };
    });
    return Object.assign(p, methods);
}


fasync.AsyncQueue = class AsyncQueue {
	constructor(opt) {
		this.pending = [];
        this.processed = 0;
        this.inflight = 0;
		this.signal = deferred();
		this.done = false;
		this.max = opt?.max || 0;
		this.active = false;
	}
	[Symbol.asyncIterator]() { return this.iterator(); }
	post(v, post_if_iterator_is_active) {
		if(this.done)
			return;
		if(post_if_iterator_is_active && !this.active)
			return;
		if(this.max) {
			while(this.pending.length >= this.max)
				this.pending.shift();
		}
		this.pending.push(v);
		this.signal.resolve();
	}
	stop(err) {
		this.err = err;
		this.abort = true;
		this.done = true;
		if(!this.inflight) {
			this.signal.resolve();
		}
	}
	clear() {
		this.pending = [];
		if(this.inflight) {
			this.abort = true;
			this.reset_ = true;
		}
	}
    get length() {
        return this.pending.length+this.inflight;
    }
	async *iterator() {

		this.active = true;

		if(this.done) {
			this.done = false;
			if(!this.pending.length)
				this.signal = deferred();
		}

		while(true) {
			if(this.pending.length === 0) {
				await this.signal;
			}
			if (this.err)
				throw this.err;

			const pending = this.pending;
			this.inflight = pending.length;
			this.pending = [];
			let processed = 0;
			for (; processed < pending.length && !this.abort; processed++) {
                this.processed++;
                yield pending[processed];
				this.inflight--;
			}


			if(this.reset_) {
				this.abort = false;
				this.reset_ = false;
				pending.length = 0;
			}
			
			if(this.done) {
				this.abort = false;
				const incoming = this.pending.length;
				if(incoming)
					this.pending = processed ? pending.slice(processed).concat(this.pending) : pending.concat(this.pending);
				else
					this.pending = processed ? pending.slice(processed) : pending;
				this.inflight = 0;
				break;
			}
			else if (this.pending.length === 0) {
				this.inflight = 0;
				pending.length = 0;
				this.pending = pending;
				this.signal = deferred();
			}
		}

		this.active = false;
	}
}

fasync.AsyncQueueSubscriberMap = class AsyncQueueSubscriberMap {
	constructor(options) {
		this.lossless = options?.lossless || false;
		this.map = new Map();
	}

	subscribe(subject, opt) {
		let subscribers = this.map.get(subject);
		if(!subscribers) {
			subscribers = [];
			this.map.set(subject,subscribers);
		}
		let queue = new fasync.AsyncQueue();
		subscribers.push(queue);
		return queue;
	}

	post(subject, msg) {
		let subscribers = this.map.get(subject);
		if(subscribers)
			for(const subscriber of subscribers)
				subscriber.post(msg, this.lossless);
	}

	shutdown() {
		this.map.forEach((subscribers) => {
			subscribers.forEach(queue => {
				queue.stop();
				queue.clear();
			});
		});
		this.map.clear();
	}
}

module.exports = fasync;
