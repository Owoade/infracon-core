export interface UserModelInterface {

    id?: number;

    email: string;

    password: string;

    name: string;

    is_disabled?: boolean;

    photo?: {
        id: string,
        link: string
    }

    type: "USER";

}

export interface GetUsers {

    page: number,

    per_page: number;

    search: string;

}

export interface UpdateUser {

    password?: {
        old: string,
        new: string
    },

    name?: string,

    photo?: UserModelInterface['photo']

}