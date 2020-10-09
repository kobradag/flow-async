const fasync = { };

fasync.dpc = (delay, fn)=>{
	if(typeof delay == 'function')
		return setTimeout(delay, fn||0);
	return setTimeout(fn, delay||0);
}

fasync.clearDPC = (dpc_)=>{
	clearTimeout(dpc_);
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

fasync.deferred = () => {
    let methods = {};
    const p = new Promise((resolve, reject) => {
        methods = { resolve, reject };
    });
    return Object.assign(p, methods);
}

module.exports = fasync;
