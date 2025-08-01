export class HttpError extends Error {
	public statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.statusCode = statusCode;
		this.name = 'HttpError';
		Object.setPrototypeOf(this, HttpError.prototype);
	}
}
