# Tài liệu Dự án: API Backend cho Short Film từ Pangle

## 1. Tổng quan dự án
Dự án phát triển một API Backend để thu thập, xử lý, lưu trữ và phân phối dữ liệu short film từ nguồn Pangle. Hệ thống thực hiện các tác vụ:
- **Fetch dữ liệu**: Trích xuất danh sách short film và metadata từ Pangle thông qua API, lưu vào MongoDB.
- **Xử lý video chunks**: Tải các video chunks từ link stream của Pangle, hợp nhất thành file MP4 bằng logic tùy chỉnh, lưu trữ tạm trên disk, sau đó upload lên BunnyCDN.
- **Expose APIs**: Cung cấp endpoint để người dùng cuối truy xuất thông tin short film, bao gồm metadata, link MP4 (BunnyCDN) và link stream (Pangle hoặc từ MP4).

Hệ thống được thiết kế để tối ưu hiệu năng, bảo mật và khả năng mở rộng, đặc biệt khi xử lý các file video ~100MB.

---

## 2. Phân tích chi tiết các tính năng

### 2.1. Fetch toàn bộ Short Film Data
**Mô tả**:
- Trích xuất danh sách short film từ Pangle qua API `/bytedrama/open/api/sp/file/list`.
- Quá trình trích xuất data cụ thể như sau:
  > Trích xuất tuần tự từ page 1 đến hết
  > Filter theo 1 language nhất định
  > Lưu full metadata của mỗi short film vào MongoDB

**Chi tiết API Pangle**:
- **Request**:
  ```bash
  curl --request POST \
    --url https://.../bytedrama/open/api/sp/file/list \
    --header 'Accept: */*' \
    --header 'Accept-Encoding: gzip, deflate, br' \
    --header 'Connection: Keep-Alive' \
    --header 'Content-Type: application/json' \
    --header 'User-Agent: okhttp/4.12.0' \
    --data '{
      "auth_info": {
        "user_id": "***",
        "role_id": "***",
        "timestamp": "1740129720",
        "sign": "d8e1******************36bf3"
      },
      "page_info": {
        "page": 1,
        "page_size": 1000
      },
      "controller": { "lang": ["zh_hant"] }
    }'
  ```
  - **Giải thích**:
    - `auth_info`: Chứa thông tin xác thực (user_id, role_id, timestamp, sign).
    - `page_info`: Phân trang, với `page` và `page_size`.
    - `controller.lang`: Lọc theo ngôn ngữ (ví dụ: zh_hant).
- **Response**:
  ```json
  {
    "code": "100",
    "data": [
      {
        "shortplay_id": 102084,                   // Short Film ID
        "file_id": 4060,                          // Short Film ID + Language + Voice Language
        "category": [
          {
            "id": 1,
            "name": "男频/Male Category"
          }
        ],
        "cover_image": "",
        "desc": "",
        "is_test": 1,
        "lang": "zh_hant",
        "progress_state": 1,
        "title": "妻子不能說的秘密",
        "voice_lang": "zh_hans",
        "total": 75                               // Tổng số episodes của Short Film
      }
    ],
    "message": "ok",
    "page_info": {
      "page": 1,
      "page_size": 1000,
      "total": 1,
      "total_page": 1
    }
  }
  ```
  - **Giải thích**:
    - `code`: Mã trạng thái (100 là thành công).
    - `data`: Danh sách short film với các trường như `shortplay_id`, `file_id`, `title`, `total`.
    - `page_info`: Thông tin phân trang.

**Giải pháp kỹ thuật**:
- **Gọi API Pangle**:
  - Sử dụng `axios` để gửi POST request.
  - Xử lý xác thực bằng cách tạo `sign` (giả định sử dụng HMAC-SHA256).
  - Ví dụ:
    ```javascript
    const axios = require('axios');
    const crypto = require('crypto');
    const fetchShortFilms = async (page = 1, pageSize = 1000) => {
      const authInfo = {
        user_id: process.env.PANGLE_USER_ID,
        role_id: process.env.PANGLE_ROLE_ID,
        timestamp: Math.floor(Date.now() / 1000).toString(),
      };
      const sign = crypto.createHmac('sha256', process.env.PANGLE_SECRET)
        .update(JSON.stringify(authInfo))
        .digest('hex');
      const response = await axios.post('https://.../bytedrama/open/api/sp/file/list', {
        auth_info: { ...authInfo, sign },
        page_info: { page, page_size: pageSize },
        controller: { lang: ['zh_hant'] }
      });
      return response.data.data;
    };
    ```
- **Lưu trữ metadata**:
  - Sử dụng MongoDB với Mongoose.
  - Schema mẫu:
    ```javascript
    const ShortFilmSchema = new mongoose.Schema({
      shortplay_id: { type: Number, unique: true },
      file_id: Number,
      title: String,
      desc: String,
      categoryId: Number,
      lang: String,
      voice_lang: String,
      total: Number,
      episodes: Array, // default is []
      createdAt: Date,
      updatedAt: Date
    });
    ```
- **Tối ưu hóa**:
  - Lên lịch đồng bộ bằng `node-cron` (mỗi giờ).
  - Sử dụng phân trang để fetch tất cả các page.
  - Triển khai retry với `axios-retry`.

**Công cụ**:
- Node.js + Express.js / NestJS
- MongoDB + Mongoose
- Axios, axios-retry
- node-cron

---

### 2.2. Xử lý Video Link của Short Episodes
**Mô tả**:
- Truy cập từng Short film, lấy list episodes của mỗi Short (theo `file_id`) từ API `/bytedrama/open/api/sp/file/download`.
- Tải video chunks, hợp nhất thành file MP4 bằng logic tùy chỉnh, lưu trữ tạm trên disk, sau đó upload lên BunnyCDN.
- Lưu `origin_stream_link` và `cdn_file_link` vào MongoDB.

**Chi tiết API Pangle**:
- **Request**:
  ```bash
  curl --request POST \
    --url https://.../bytedrama/open/api/sp/file/download \
    --header 'Accept: */*' \
    --header 'Accept-Encoding: gzip, deflate, br' \
    --header 'Connection: Keep-Alive' \
    --header 'Content-Type: application/json' \
    --header 'User-Agent: okhttp/4.12.0' \
    --data '{
      "auth_info": {
        "user_id": "*****",
        "role_id": "*****",
        "timestamp": "1740467035",
        "sign": "6620***************264fdce"
      },
      "controller": {
        "download_config": [
          {
            "file_id": 4028,
            "target_index": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]       // Mặc định sẽ fetch 10 episodes mỗi Short Film
          }
        ]
      }
    }'
  ```
  - **Giải thích**:
    - `auth_info`: Thông tin xác thực.
    - `controller.download_config`: Chỉ định `file_id` và danh sách `target_index` của episodes.
- **Response**:
  ```json
  {
    "code": "100",
    "data": [
      {
        "episode_list": [
          {
            "index": 1,
            "name": "1.mp4",
            "play_url": "https://8309530.panglepublisher.com/319db0f33630465fb5ef0202cf5719fe?auth_key=1740503228-bba6d41405-0-1c4ed830a5a2a3fa875052a187c5df01"
          }
        ],
        "file_id": 4028,
        "lang": "zh_hant",
        "shortplay_id": 101924,
        "voice_lang": "zh_hans"
      }
    ],
    "message": "ok"
  }
  ```
  - **Giải thích**:
    - `episode_list`: Danh sách episode với `index`, `name`, và `play_url` (link stream).

**Giải pháp kỹ thuật**:
#### a. Tải và hợp nhất video chunks
- **Tải video chunks**:
  - Sử dụng logic tùy chỉnh từ mã mẫu để tải và hợp nhất chunks:
    ```javascript
    const fs = require('fs').promises;
    const path = require('path');
    const fetch = require('node-fetch');
    const downloadChunks = async (url, fileName, outputDir) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      let loadedLength = 0;
      const chunks = {};
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks[loadedLength] = value;
        loadedLength += value.length;
      }
      const chunksAll = new Uint8Array(loadedLength);
      Object.keys(chunks).forEach(index => {
        chunksAll.set(chunks[index], Number(index));
      });
      await fs.writeFile(path.join(outputDir, fileName), chunksAll);
    };
    ```
  - **Cải tiến mã**:
    - Thêm progress bar với `cli-progress`:
      ```javascript
      const cliProgress = require('cli-progress');
      const downloadChunks = async (url, fileName, outputDir) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        let loadedLength = 0;
        const chunks = {};
        const reader = response.body.getReader();
        progressBar.start(100, 0);
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            progressBar.update(100);
            progressBar.stop();
            break;
          }
          chunks[loadedLength] = value;
          loadedLength += value.length;
          const progress = Math.min(Math.ceil((loadedLength / (response.headers.get('content-length') || loadedLength)) * 100), 100);
          progressBar.update(progress);
        }
        const chunksAll = new Uint8Array(loadedLength);
        Object.keys(chunks).forEach(index => {
          chunksAll.set(chunks[index], Number(index));
        });
        await fs.writeFile(path.join(outputDir, fileName), chunksAll);
      };
      ```
    - Sử dụng stream để giảm sử dụng bộ nhớ:
      ```javascript
      const stream = require('stream');
      const { pipeline } = require('stream/promises');
      const downloadChunksStream = async (url, filePath) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        await pipeline(response.body, fs.createWriteStream(filePath));
      };
      ```
- **Hợp nhất chunks**:
  - Logic trên đã hỗ trợ hợp nhất chunks thành file MP4 hoàn chỉnh bằng cách sử dụng `Uint8Array` để gộp dữ liệu.
  - Lưu file MP4 tạm vào `/tmp/videos`.

#### b. Upload file MP4 lên BunnyCDN
- **Kích thước file**: ~100MB.
- **Upload path**: `/st16b/pangle/drama/${shortplay_id}/${file_id}/...`
- **Phương án 1: Upload trực tiếp**:
  ```javascript
  const axios = require('axios');
  const fs = require('fs');
  const uploadToBunnyCDN = async (filePath, bunnyCdnUrl, apiKey) => {
    const fileStream = fs.createReadStream(filePath);
    await axios.put(bunnyCdnUrl, fileStream, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'video/mp4'
      }
    });
  };
  ```
- **Phương án 2: Resumable Upload**:
  - Sử dụng `upchunk` để upload theo chunks (10MB mỗi chunk).
  - Ví dụ:
    ```javascript
    const Upchunk = require('@mux/upchunk');
    const upload = Upchunk.createUpload({
      endpoint: 'https://your-bunnycdn-upload-url',
      file: fs.createReadStream(filePath),
      chunkSize: 10 * 1024 * 1024
    });
    upload.on('success', () => console.log('Upload completed'));
    ```
- **Đề xuất**: Build cả 2 phương án

#### c. Lưu trữ metadata
- Cập nhật MongoDB với `origin_stream_link` và `cdn_file_link`.
- Schema episode:
  ```javascript
  episodes: [
    {
      episodeId: String,
      index: Number,
      name: String,
      origin_stream_link: String,   // Mapping với field `play_url` trong Pangle Response
      cdn_file_link: String         // Storage link (uploaded to BunnyCDN)
    }
  ]
  ```
- Ví dụ cập nhật:
  ```javascript
  await ShortFilm.updateOne(
    { shortplay_id, 'episodes.episodeId': episodeId },
    {
      $set: {
        'episodes.$.origin_stream_link': playUrl,
        'episodes.$.cdn_file_link': cdnUrl
      }
    }
  );
  ```

**Công cụ**:
- Bull (Redis): Ở đây, setup cho queue chạy đồng thời 3-5 tasks.
- Upchunk, Axios: Upload file.
- MongoDB + Mongoose: Lưu trữ metadata.
- cli-progress: Hiển thị tiến độ.

---

### 2.3. Expose APIs cho End-Users
**Mô tả**:
- Endpoint `GET /api/short-films/:shortplayId` để lấy thông tin short film và episodes.
- Trả về cả `cdn_file_link` (MP4) và `origin_stream_link` (HLS).

**Giải pháp kỹ thuật**:
- **Endpoint**: `GET /api/short-films/:shortplayId`
  - **Response mẫu**:
    ```json
    {
      "shortplay_id": 102084,
      "file_id": 4028,
      "lang": "zh_hant",
      "episodes": [
        {
          "episodeId": "ep1",
          "index": 1,
          "name": "1.mp4",
          "origin_stream_link": "https://8309530.panglepublisher.com/319db0f33630465fb5ef0202cf5719fe?auth_key=...",
          "cdn_file_link": "https://bunnycdn.com/st16b/pangle/drama/${shortplay_id}/${file_id}/ep1.mp4"
        }
      ]
    }
    ```
- **Chuyển đổi MP4 thành stream**:
  - Nếu client yêu cầu stream, sử dụng logic tương tự để phân tách MP4 thành chunks và tạo file `.m3u8` (tùy chỉnh nếu cần).
  - Upload file `.m3u8` và chunks lên BunnyCDN, trả về link stream.
  - Note: Cân nhắc chuyển tính năng này xử lý trước ở **Luồng 2**

**Công cụ**:
- Express.js / NestJS
- Mongoose
- Redis

---

## 3. Cấu trúc dự án (tham khảo - có thể thay đổi)
```
project/
├── src/
│   ├── controllers/
│   │   └── shortFilmController.js
│   ├── services/
│   │   ├── pangleService.js
│   │   ├── videoProcessing.js
│   │   └── bunnyCdnService.js
│   ├── models/
│   │   └── ShortFilm.js
│   ├── routes/
│   │   └── shortFilmRoutes.js
│   ├── middlewares/
│   │   └── auth.js
│   └── utils/
│       └── download.js
├── tmp/
├── .env
├── package.json
└── README.md
```

---

## 4. Công nghệ sử dụng
- Node.js, Express.js / NestJS
- MongoDB, Mongoose
- node-fetch, cli-progress
- Upchunk, Axios
- Bull (Redis)
- node-cron
- Redis
