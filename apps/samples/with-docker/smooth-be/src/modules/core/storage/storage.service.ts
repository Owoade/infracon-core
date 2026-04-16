import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_STORAGE_BUCKET_NAME } from "@env/index";
import { Injectable } from "@nestjs/common";
import s3_client from "./client";

@Injectable()
export class StorageService {

    constructor(){}

    async get_presigned_url( key: string ){

        const command = new PutObjectCommand({ Bucket: AWS_STORAGE_BUCKET_NAME, Key: key });

        return getSignedUrl(s3_client, command, { expiresIn: 3600 });

    }

    async delete_file( key: string ){

        const command = new DeleteObjectCommand({
            Key: key,
            Bucket: AWS_STORAGE_BUCKET_NAME
        })

        await s3_client.send( command );
        
    }


    async save_file( buffer: Buffer, file_name: string, content_type: string ): Promise<void> {

        console.log({
            buffer,
            file_name
        })

        const params = {
            Bucket: AWS_STORAGE_BUCKET_NAME,
            Body: buffer,
            Key: file_name,
            ContentType: content_type,
        };

        const command = new PutObjectCommand(params);

        await s3_client.send(command);
        
    }

}