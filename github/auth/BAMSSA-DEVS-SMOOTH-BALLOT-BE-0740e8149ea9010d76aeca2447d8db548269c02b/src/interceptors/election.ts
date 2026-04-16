import { ElectionService } from "@modules/election/election.service";
import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";

@Injectable()
export class ElectionAuthInterceptor implements NestInterceptor {

    constructor(
        private election_service: ElectionService
    ){}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<any> {

        const election_auth_payload = context.getArgByIndex(0);

        const { UserId, id } = election_auth_payload;

        const election = await this.election_service.get_cached_election(id, UserId);

        if( election.is_disabled ) throw new ForbiddenException("Election has been disabled");

        const all_args = context.getArgs();

        all_args[all_args.length - 1] = election;

        return next.handle();
        
    }
}