import { forwardRef, Module } from "@nestjs/common";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { UserModule } from "@modules/user";
import { AuthModule } from "../auth";

@Module({
    imports: [ forwardRef(()=> UserModule), AuthModule],
    controllers: [StorageController],
    providers: [StorageService],
    exports: [StorageService]
})
export class StorageModule{}