<template>
  <div class="container">
    <input ref="inputRef" type="file" @change="changeFile" />
    <div>分了 {{ chunksCount }} 片：</div>
    <div>hash 值：{{ fileHash }}</div>

    <div>
      <span>文件进度：</span>
      <progress max="100" :value="fileProgress"></progress> {{ fileProgress }}%
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { calcFileMd5, checkFile, mergeFile, sliceFile, uploadFile } from '@/util/file';


const chunksCount = ref(0);
const inputRef = ref();
const fileHash = ref('');
const CHUNK_SIZE = 1 * 1024 * 1024;
const fileProgress = ref(0);

const changeFile = async () => {
  const file = inputRef.value.files[0];
  const chunks = sliceFile(file, CHUNK_SIZE);
  chunksCount.value = chunks.length;
  const fileMd5 = await calcFileMd5(chunks);
  fileHash.value = fileMd5;
  uploadFileCheck(fileMd5, chunks, file.name);
}

let formDataList = [];
let doneFileList: string[] = [];
const uploadFileCheck = async (fileMd5: string, chunks: Blob[], fileName: string) => {

  const res = await checkFile(fileMd5);

  // 已经上传过
  if (res.data.errno === 1) {
    console.log('已经上传过');
    return;
  }

  // 部分上传过
  if (res.data.errno === 2) {
    doneFileList = res.data.data;
  }

  let fileList = chunks;
  doneFileList.length !== 0 && (fileList = chunks.filter((_, index) => !doneFileList.includes(index + '')));

  formDataList = fileList.map((item: Blob, index: number) => {
    let formData = new FormData();
    formData.append("chunks", chunks.length + '');
    formData.append("chunkIndex", index + '');
    formData.append("name", fileName);
    formData.append("md5", fileMd5);
    formData.append("file", item);
    return formData;
  });

  fileUpload(formDataList, fileName);
}

const fileUpload = (formDataList: FormData[], fileName: string) => {
  const requestList = formDataList.map(async formData => {
    const res = await uploadFile(formData);
    console.log(res, 'fileUpload');
    // 每上传完毕一片文件，后端告知已上传了多少片，除以总片数，就是进度
    fileProgress.value = Math.ceil(
      (res.data.data / chunksCount.value) * 100
    );
    return res;
  });

  Promise.allSettled(requestList).then(async () => {
    // 上传完毕了，文件上传进度条就为100%了
    fileProgress.value = 100;
    // 最后再告知后端合并一下已经上传的文件碎片了即可
    const res = await mergeFile(fileName, fileHash.value);
    if (res.data.errno === 0) {
      console.log("文件并合成功");
    }
  });
}
</script>

<style scoped></style>
