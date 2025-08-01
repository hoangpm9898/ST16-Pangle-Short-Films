import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Session = createParamDecorator((data: unknown, ctx: ExecutionContext): Session => {
	const request = ctx.switchToHttp().getRequest();
	return request.session as Session;
});

export type Session = {};
