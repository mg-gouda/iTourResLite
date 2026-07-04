import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/http-error.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.use(require("express").json({ limit: "5mb" }));
  app.use(require("express").urlencoded({ limit: "5mb", extended: true }));
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
    credentials: true,
  });
  app.useGlobalFilters(new HttpErrorFilter());

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}/api/v1`);
}
bootstrap();
