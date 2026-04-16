import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import db from './db/postgres';
import * as cookieParser from 'cookie-parser';
import { QueryTypes } from 'sequelize';
import * as morgan from "morgan";
import mongoose from 'mongoose';
import { MONGODB_URL } from './environment';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  app.use(morgan('tiny'));

  app.enableCors({
    methods: '*',
    origin: '*',
  });

  app.use(cookieParser())

  db.authenticate().then(
    async () =>{

      const platform = await db.query(`SELECT * FROM "Platforms" WHERE id=1`, { type: QueryTypes.SELECT });

      if( platform.length === 0 )
        await db.query(`INSERT INTO "Platforms" (income, price_per_voter, price_per_month) VALUES (0, 100, 2000);`)

      await mongoose.connect(MONGODB_URL)

      await app.listen( (parseInt(process.env.PORT) || null) ?? 3000 );
      
    }
  );


}

bootstrap()


