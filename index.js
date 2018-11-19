//Hackey solution. It is better to use _.isEqual or other optimized analogies.
const isEqual = (A, B) => JSON.stringify(A) === JSON.stringify(B);

class CompositeRequest {
    /**@param fetchFn {function} function to be called with the array of stashed data to fetch (normally array parser and server request)
     * @param getResultFromResponseFn {function} function to parse the response (returned by fetchFn) and
     * return the result for 1 particular  stashed entry.
     * getResultFromResponseFn param response {Array} result (not promise) of fetchFn
     * getResultFromResponseFn param data {Array} one stashed data entry that was previously passed to this.getCompositeData(data)
     */
    constructor(fetchFn = () => Promise.resolve([]), getResultFromResponseFn = (response, data) => response) {
        this.fetchFn = fetchFn ;
        this.getResultFromResponseFn = getResultFromResponseFn;
    }
    _requestsToGet = [];
    _debounceTime = 200;
    _rejectTime = 10*1000;

    getCompositeData = (data) => {
        if (this._requestsToGet.length === 0) {
            this._initiateServerRequest();
        }
        let stashedRequest = this._requestsToGet.find( el => isEqual(el.data, data) );
        if (!stashedRequest) {
            stashedRequest = {data, subscribers: []};
            this._requestsToGet.push(stashedRequest);
        }
        return this._createSubscriberPromise(data, stashedRequest);
    };

    _createSubscriberPromise = (data, stashedRequest) => new Promise((resolve, reject) => {
        setTimeout(reject, this._rejectTime); //reject after some time (10s by default)
        const subscriber = (result) => {
            if (result) resolve(result);
            else reject();
        };
        if (stashedRequest) stashedRequest.subscribers.push(subscriber);
        else reject(); //rejected if no corresponding stashed request. Should not be ever executed, but still.
    });

    _initiateServerRequest = () => {
        setTimeout(async () => {
            //New stashed data will be resolved in another timed out request.
            // Current data will be copied (to be resolved after this.fetchFn()) and array of pending data will be cleared
            const currentRequestsToGet = [...this._requestsToGet];
            this._requestsToGet.length = 0;
            try {
                const res = await this.fetchFn(currentRequestsToGet.map(request => request.data));
                this._resolveSubscribers(res, currentRequestsToGet);
            } catch (err) {
                this._rejectSubscribers(currentRequestsToGet);
            }
        }, this._debounceTime);
    };

    _resolveSubscribers = (response, currentPackages) => {
        currentPackages.forEach(pck => {
            const result = this.getResultFromResponseFn(response, pck.data);
            pck.subscribers.forEach(subscriber => subscriber(result))
        });
    };
    _rejectSubscribers = (currentPackages) => {
        currentPackages.forEach(request => {
            request.subscribers.forEach(subscriber => subscriber()); //promise will be reject if no params passed;
        })
    }
}

export default CompositeRequest;