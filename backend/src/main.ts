import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AI Food Waste Exchange API')
    .setDescription('Connects food donors with NGOs and volunteers')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API running on port ${process.env.PORT ?? 3000} — Swagger at /docs`);
}
bootstrap();
