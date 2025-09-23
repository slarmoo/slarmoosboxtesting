export class DenseSet {
    private _size: number = 0;
    public set: Array<number | undefined> = [];
    private _maxVal: number = 0;
    private _lastGrabbed: number = 0;

    constructor(initialize?: any) {
        for (const val in initialize) {
            const element: number = Number(val);
            if(!Number.isNaN(element)) {
                this.add(Number(element));
            }
        }
    }

    public add(element: number): void {
        if (this.set[element] === undefined) {
            this.set[element] = element;
            this._size++;
            if (element > this._maxVal) this._maxVal = element;
        }
    }

    public has(element: number): boolean {
        return this.set[element] !== undefined;
    }

    public delete(element: number): void {
        if (this.set[element] !== undefined) {
            this.set[element] = undefined;
            this._size--;
        }
    }

    public size(): number {
        return this._size;
    }

    /**
     * Makes sure that grabbing results in an ordered list
     */
    public pointToBeginning(): void {
        this._lastGrabbed = 0;
    }

    /**
     * Combined with a for loop over the size of the dense set, this will grab every item in the set
     * @returns a value in the set
     */
    public grab(): number | undefined {
        for (let i: number = this._lastGrabbed; i <= this._maxVal; i++) {
            if (this.set[i] !== undefined) {
                this._lastGrabbed = i + 1;
                return i;
            }
        }
        for (let i: number = 0; i < this._lastGrabbed; i++) {
            if (this.set[i] !== undefined) {
                this._lastGrabbed = i + 1;
                return i;
            }
        }
        this._lastGrabbed = 0;
        this._maxVal = 0;
        return undefined
    }

    public clear(): void {
        this.set = [];
        this._size = 0;
        this._maxVal = 0;
        this._lastGrabbed = 0;
    }

    public getArray(): number[] {
        const arr: number[] = [];
        for (let i: number = 0; i <= this._maxVal; i++) {
            if (this.set[i] !== undefined) {
                arr.push(i);
            }
        }
        return arr;
    }
}