// import { OnModuleInit } from "@nestjs/common";
// import { ClientGrpc } from "@nestjs/microservices";
// import { GetLogs } from "./type";

// export class LogService implements OnModuleInit {

//     private log_service;
    
//     constructor(
//         private client: ClientGrpc
//     ){}

//     onModuleInit() {

//         this.log_service = this.client.getService('LogService');

//     }

//     async get_logs( payload: GetLogs ){

//         const logs = await this.log_service.getLogs( payload ).toPromise();

//         return logs;

//     }
    
// }