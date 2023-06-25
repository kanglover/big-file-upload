import SparkMD5 from 'spark-md5';
import axios from "axios";

export const sliceFile = (file: File, chunkSize: number): Blob[] => {
    const result = [];
    for (let i = 0; i < file.size; i += chunkSize) {
        result.push(file.slice(i, i + chunkSize));
    }
    return result;
}

export const calcFileMd5 = (chunks: Blob[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        let chunkIndex = 0;
        const spark = new SparkMD5.ArrayBuffer()
        const fileReader = new FileReader()

        fileReader.readAsArrayBuffer(chunks[chunkIndex]);
        fileReader.onerror = reject;
        fileReader.onload = (e: ProgressEvent<FileReader>) => {
            spark.append(e?.target?.result as ArrayBuffer);
            chunkIndex++;
            if (chunkIndex < chunks.length) {
                fileReader.readAsArrayBuffer(chunks[chunkIndex]);
            }
            else {
                resolve(spark.end());
            }
        }
    });
}

export const uploadFile = (fileData: FormData) => {
    return axios.post("http://127.0.0.1:3000/bigfile/upload", fileData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
}

export const checkFile = (fileMd5: string) => {
    return axios.post(`http://127.0.0.1:3000/bigfile/check?fileMd5=${fileMd5}`);
}

export const mergeFile = (fileName: string, fileMd5: string) => {
    return axios.post(`http://127.0.0.1:3000/bigfile/merge?fileName=${fileName}&fileMd5=${fileMd5}`);
}