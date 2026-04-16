import { DATABASE_HOST, DATABASE_NAME, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_USER } from "@env/index";

module.exports = {
    development: {
       dialect: 'postgres',
       host: DATABASE_HOST,
       port: DATABASE_PORT,
       username: DATABASE_USER,
       password: DATABASE_PASSWORD,
       database: DATABASE_NAME,
       dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        } 
      }
    },
    test: {
      dialect: 'postgres',
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      username: DATABASE_USER,
      password: DATABASE_PASSWORD,
      database: DATABASE_NAME,
    },
    production: {
      dialect: 'postgres',
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      username: DATABASE_USER,
      password: DATABASE_PASSWORD,
      database: DATABASE_NAME,
    },
 }