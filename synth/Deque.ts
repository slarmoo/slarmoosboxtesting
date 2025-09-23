// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

export class Deque<T> {
	private _capacity: number = 1;
	private _buffer: Array<T | undefined> = [undefined];
	private _mask: number = 0;
	private _offset: number = 0;
	private _count: number = 0;

	/**
	 * Pushes an element to the front of the deque
	 * @param element The element to push
	 */
	public pushFront(element: T): void {
		if (this._count >= this._capacity) this._expandCapacity();
		this._offset = (this._offset - 1) & this._mask;
		this._buffer[this._offset] = element;
		this._count++;
	}
	/**
	 * Pushes an element to the back of the deque
	 * @param element The element to push
	 */
	public pushBack(element: T): void {
		if (this._count >= this._capacity) this._expandCapacity();
		this._buffer[(this._offset + this._count) & this._mask] = element;
		this._count++;
	}
	/**
	 * Removes and returns the frontmost element
	 * @returns The frontmost element in the deque
	 */
	public popFront(): T {
		if (this._count <= 0) throw new Error("No elements left to pop.");
		const element: T = <T>this._buffer[this._offset];
		this._buffer[this._offset] = undefined;
		this._offset = (this._offset + 1) & this._mask;
		this._count--;
		return element;
	}
	/**
	 * Removes and returns the backmost element
	 * @returns The backmost element in the deque
	 */
	public popBack(): T {
		if (this._count <= 0) throw new Error("No elements left to pop.");
		this._count--;
		const index: number = (this._offset + this._count) & this._mask;
		const element: T = <T>this._buffer[index];
		this._buffer[index] = undefined;
		return element;
	}
	/**
	 * @returns The frontmost element in the deque
	 */
	public peakFront(): T {
		if (this._count <= 0) throw new Error("No elements left to pop.");
		return <T>this._buffer[this._offset];
	}
	/**
	 * @returns The backmost element in the deque
	 */
	public peakBack(): T {
		if (this._count <= 0) throw new Error("No elements left to pop.");
		return <T>this._buffer[(this._offset + this._count - 1) & this._mask];
	}
	/**
	 * @returns The size of the deque
	 */
	public count(): number {
		return this._count;
	}
	/**
	 * Update an element at an index of the deque
	 * @param index The index of the element
	 * @param element The new element to replace the old one
	 */
	public set(index: number, element: T): void {
		if (index < 0 || index >= this._count) throw new Error("Invalid index");
		this._buffer[(this._offset + index) & this._mask] = element;
	}
	/**
	 * Get an element at an index from the deque
	 * @param index The index of the element
	 * @returns The element at that index
	 */
	public get(index: number): T {
		if (index < 0 || index >= this._count) throw new Error("Invalid index");
		return <T>this._buffer[(this._offset + index) & this._mask];
	}
	/**
	 * Removes an element from the deque at a specified index
	 * @param index The index of the element that you want to remove
	 */
	public remove(index: number): void {
		if (index < 0 || index >= this._count) throw new Error("Invalid index");
		if (index <= (this._count >> 1)) {
			while (index > 0) {
				this.set(index, this.get(index - 1));
				index--;
			}
			this.popFront();
		} else {
			index++;
			while (index < this._count) {
				this.set(index - 1, this.get(index));
				index++;
			}
			this.popBack();
		}
	}
	private _expandCapacity(): void {
		if (this._capacity >= 0x40000000) throw new Error("Capacity too big.");
		this._capacity = this._capacity << 1;
		const oldBuffer: Array<T | undefined> = this._buffer;
		const newBuffer: Array<T | undefined> = new Array(this._capacity);
		const size: number = this._count | 0;
		const offset: number = this._offset | 0;
		for (let i = 0; i < size; i++) {
			newBuffer[i] = oldBuffer[(offset + i) & this._mask];
		}
		for (let i = size; i < this._capacity; i++) {
			newBuffer[i] = undefined;
		}
		this._offset = 0;
		this._buffer = newBuffer;
		this._mask = this._capacity - 1;
	}
}