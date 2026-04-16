import { Controller, Get, Injectable, UseInterceptors } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { RequestPayload, User } from "@decorators/index";
import { id_validator, id_validator_string } from "@validators/utils";
import { response } from "@utils/response";
import { UserModelInterface } from "@modules/user/type";
import { UserAuthInterceptor } from "src/interceptors/auth";

@Injectable()
@Controller('storage')
@UseInterceptors(UserAuthInterceptor)
export class StorageController {

    constructor(
        private service: StorageService
    ){}

    @Get("/url")
    async get_presigned_url(
        @RequestPayload({
            validator: id_validator_string("key"),
            type: "query"
        })
        payload: { key: string },
    ){

        const url = await this.service.get_presigned_url(payload.key);

        return response({
            status: true,
            statusCode: 200,
            data: {
                url
            }
        })
    }

}