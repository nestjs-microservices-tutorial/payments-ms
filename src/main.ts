import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config';
import { urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create(AppModule,{
    rawBody:true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  logger.log(`Payments Microservice running at port:${envs.port}`);
  await app.listen(envs.port);
}
bootstrap();
