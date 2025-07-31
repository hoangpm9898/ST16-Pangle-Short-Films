export class ApiResponse {
	public success: boolean;
	public code: number;
	public message: string;
	public error: string | unknown;
	public data: any;
	public meta: Meta;

	constructor(success: boolean, code: number, error: string | unknown = undefined, data: any = undefined) {
		this.success = success;
		this.code = code;
		this.error = error;
		this.data = data;
	}

	static Error(code: number, error: string | unknown, data: any = undefined) {
		return new ApiResponse(false, code, error, data);
	}

	static Success(data: any = undefined) {
		return new ApiResponse(true, undefined, undefined, data);
	}

	static OK(data: any = undefined) {
		return new ApiResponse(true, undefined, undefined, data);
	}

	static list<T = any>(res: Pagination<T>) {
		return new ApiResponse(true, undefined, undefined, res.data).setMeta(res.meta);
	}

	setMeta(meta: Meta) {
		this.meta = meta;
		return this;
	}

	withMessage(message: string) {
		this.message = message;
		return this;
	}
}

export type Meta = {
	offset?: number;
	limit?: number;
	total?: number;
	count?: number;
};

export type Pagination<T = any> = {
	data: T[];
	meta: Meta;
};
