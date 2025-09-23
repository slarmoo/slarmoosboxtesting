export class BeepboxSet {
    private _size: number = 0;
    public set: Array<number | undefined> = [];
    private _maxVal: number = 0;
    private _lastGrabbed: number = 0;

    /**
     * Creates a Set. Can optionally be initialized with data
     * @param initialize Data to initialize the set with. Preferably is filled with numbers and can be iterated over with a for _ of _
     */
    constructor(initialize?: any) {
        if (initialize) {
            for (const val of initialize) {
                const element: number = Number(val);
                if (!Number.isNaN(element)) {
                    this.add(Number(element));
                }
            }
        }
    }

    /**
     * Adds an element to the set
     * @param element the element to add
     */
    public add(element: number): void {
        if (this.set[element] === undefined) {
            this.set[element] = element;
            this._size++;
            if (element > this._maxVal) this._maxVal = element;
        }
    }

    /**
     * Tests if an element is in the set
     * @param element the element to test
     * @returns whether or not the element is in the set
     */
    public has(element: number): boolean {
        return this.set[element] !== undefined;
    }

    /**
     * Remove an element from the set
     * @param element the element to remove
     */
    public delete(element: number): void {
        if (this.set[element] !== undefined) {
            this.set[element] = undefined;
            this._size--;
        }
    }

    /**
     * Get the size of the set
     */
    public get size(): number {
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

    /**
     * Empties the set
     */
    public clear(): void {
        this.set = [];
        this._size = 0;
        this._maxVal = 0;
        this._lastGrabbed = 0;
    }

    /**
     * Turn the set into an array
     * @returns an array filled with the values of the set
     */
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