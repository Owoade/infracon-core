import { redis_client } from "@cache/index";
import { PlatformRepository } from "./repo";
import { PlatformModelInterface } from "./type";
import { Injectable } from "@nestjs/common";

@Injectable()
export class PlatformService {

    private REDIS_KEY = "PLATFORM_HASH";

    constructor(
        private platform_repo: PlatformRepository
    ){}

    async get_platform(){

        const cached_object = await redis_client.get(this.REDIS_KEY);

        if( cached_object ) return JSON.parse(cached_object) as PlatformModelInterface;

        const platform = await this.platform_repo.get_platform();

        if( platform )
            await redis_client.set(this.REDIS_KEY, JSON.stringify(platform));

        return platform;

    }

    async update_platform_rate( payload: Partial<Pick<PlatformModelInterface, 'price_per_month' | 'price_per_voter'>> ){

        const updated_platform = await this.platform_repo.update_platform_rate( payload );

        console.log(updated_platform);

        if( updated_platform )
            await redis_client.set(this.REDIS_KEY, JSON.stringify(updated_platform));

        return updated_platform;

    }

    
}