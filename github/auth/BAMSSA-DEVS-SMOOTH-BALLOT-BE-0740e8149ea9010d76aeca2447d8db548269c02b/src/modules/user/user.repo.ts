import { Inject, Injectable } from "@nestjs/common";
import { USER_MODEL_PROVIDER } from "./user.model";
import { InferedSchemaType } from "@utils/schema";
import { GetUsers, UserModelInterface } from "./type";
import { Op, Transaction } from "sequelize";

@Injectable()
export class UserRepository {
  constructor(
    @Inject(USER_MODEL_PROVIDER)
    private UserModel: InferedSchemaType<UserModelInterface>,
  ) {}

  async create(payload: UserModelInterface, transaction?: Transaction) {
    const user = await this.UserModel.create(payload, {
      ...(transaction ? { transaction } : {}),
    });

    return user?.toJSON();
  }

  async get_user_by_email(email: string) {
    const user = await this.UserModel.findOne({
      where: {
        email,
      },
    });

    return user?.toJSON();
  }

  async get_user_by_id(id: number): Promise<UserModelInterface>;
  async get_user_by_id<T extends keyof UserModelInterface>(
    id: number,
    attributes?: T[],
  ): Promise<Pick<UserModelInterface, T>>;
  async get_user_by_id<T extends keyof UserModelInterface>(
    id: number,
    attributes?: T[],
  ) {
    const user = (
      await this.UserModel.findOne({
        where: {
          id,
        },
        ...(attributes ? { attributes } : {}),
      })
    ).toJSON();

    if (attributes) return user as Pick<UserModelInterface, T>;

    return user;
  }

  async update_user_with_id(update: Partial<UserModelInterface>, id: number) {

    const updated_user = await this.UserModel.update(update, { where: { id }, returning: true });

    return updated_user?.[1]?.[0];

  }

  async get_users(payload: GetUsers, attributes?: (keyof UserModelInterface)[] ) {
    const [count, users] = await Promise.all([
      this.UserModel.count(),

      this.UserModel.findAll({
        ...( attributes ? { attributes } : {} ),
        limit: payload.per_page,
        offset: payload.per_page * ( payload.page - 1 ),
        ...(payload.search
          ? {
              where: {
                [Op.or]: [
                  { name: { [Op.like]: `%${payload.search}%` } },
                  { email: { [Op.like]: `%${payload.search}%` } },
                ],
              },
            }
          : {}),
      }),
    ]);

    return { count, users };
  }
}