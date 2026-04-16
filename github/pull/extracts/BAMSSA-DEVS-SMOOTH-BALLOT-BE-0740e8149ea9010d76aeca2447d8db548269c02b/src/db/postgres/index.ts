import { Sequelize, SyncOptions } from "sequelize";
import { DATABASE_HOST, DATABASE_NAME, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_URL, DATABASE_USER, NODE_ENV } from "@env/index";

const db = new Sequelize(
 {
  database: DATABASE_NAME,
  password: DATABASE_PASSWORD,
  port: DATABASE_PORT,
  username: DATABASE_USER,
  host: DATABASE_HOST,
  dialect: "postgres",
  dialectOptions: {
    ...(
      NODE_ENV !== "production" ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        } 
      } : {}
    )
  },
  logging: function( sql: string ){
    if( sql.includes("DROP TABLE") ) throw new Error(`POSIBBLE LOSS of data with: ${sql}`);
    console.log(sql)
  }
}
) as Sequelize & { _sync( options: SyncOptions ): Promise<any> } ;

db._sync = async function ( options: SyncOptions ){
  if( options.force ) throw new Error("Forceful migration can wipe db data");
  return await db.sync( options )
}


export default db as Omit<typeof db, 'sync'>;