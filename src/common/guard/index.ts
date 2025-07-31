/**
 * This file override the default AuthGuard from nestjs/passport
 * replace the default req.user with req.session.user
 */

// export * from './abstract.strategy';
export * from './auth.guard';
export * from './type.interface';
export * from './auth-module.options';
export * from './passport.module';
// export * from './passport.serializer';
export * from './passport.strategy';
