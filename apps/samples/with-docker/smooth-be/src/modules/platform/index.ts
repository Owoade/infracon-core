import { Module } from "@nestjs/common";
import { PlatformModelProvider } from "./model";
import { PlatformRepository } from "./repo";
import { PlatformService } from "./service";

@Module({
    providers: [ PlatformModelProvider, PlatformRepository, PlatformService ],
    exports: [PlatformRepository, PlatformModelProvider, PlatformService]
})
export class PlatformModule {}