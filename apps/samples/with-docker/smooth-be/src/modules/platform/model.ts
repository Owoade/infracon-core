import db from "@db/postgres/index";
import { PLATFORM_TABLE_NAME, PlatformSchema } from "@db/postgres/schema/platform";

const PlatformModel = db.define(PLATFORM_TABLE_NAME, PlatformSchema, { timestamps: true });

export const PLATFORM_MODEL_PROVIDER = 'PLATFORM_MODEL';

export const PlatformModelProvider = {
    provide: PLATFORM_MODEL_PROVIDER,
    useValue: PlatformModel
}