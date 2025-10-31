export interface StorageRepository {
  uploadFile(bucketName: string, fileName: string, content: Buffer | string): Promise<string>;
  downloadFile(bucketName: string, fileName: string): Promise<Buffer>;
  getFileUrl(bucketName: string, fileName: string): string;
  fileExists(bucketName: string, fileName: string): Promise<boolean>;
}
