# Hướng dẫn sử dụng Image trong DOCX Template

## 📋 Tổng quan
Hệ thống đã được cập nhật để support rendering ảnh trong DOCX template sử dụng `docxtemplater-image-module-free` - giải pháp miễn phí thay thế cho module image có phí của docxtemplater.

## 🛠 Cài đặt đã hoàn thành
```bash
npm install docxtemplater-image-module-free image-size
```

## 📝 Cách sử dụng trong Template DOCX

### 1. Syntax trong Word Template
**Quan trọng**: Đối với ảnh, bạn phải sử dụng syntax đặc biệt với dấu `%`:

```
{%fieldName}  ← Dành cho ảnh
{fieldName}   ← Dành cho text thông thường
```

### 2. Ví dụ cụ thể
Trong file `.docx` template:

```
Trainee Name: {trainee_name}
Signature: {%trainer_signature}
ID Photo: {%trainee_photo}
```

## 🖼 Các loại ảnh được hỗ trợ

### 1. Base64 Images
```json
{
  "trainer_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
}
```

### 2. File Path (Local)
```json
{
  "trainer_signature": "/path/to/signature.png",
  "trainee_photo": "assets/photos/trainee_001.jpg"
}
```

### 3. URLs (HTTP/HTTPS/S3)
```json
{
  "trainer_signature": "https://your-bucket.s3.amazonaws.com/signatures/trainer_001.png",
  "trainee_photo": "https://example.com/photos/trainee.jpg"
}
```

## ⚙️ Cấu hình Image Module

### Automatic Image Sizing
- Hệ thống tự động detect kích thước ảnh
- Tự động resize nếu ảnh quá lớn (max width: 300px)
- Giữ nguyên tỷ lệ khung hình

### Error Handling
- Nếu ảnh không tồn tại → hiển thị ảnh trống (1x1px)
- Nếu URL invalid → log warning và continue
- Nếu base64 invalid → fallback gracefully

## 🔧 Field Types được hỗ trợ

Trong database, các field types sau được xử lý đặc biệt cho ảnh:
- `SIGNATURE_IMG`
- `SIGNATURE_DRAW` 
- `IMAGE`

## 📖 Ví dụ hoàn chỉnh

### 1. Database Assessment Values
```
templateField.fieldType = "SIGNATURE_IMG"
templateField.fieldName = "trainer_signature"
assessmentValue.answerValue = "https://bucket.s3.amazonaws.com/signatures/trainer_123.png"
```

### 2. Word Template
```
Trainer Signature: {%trainer_signature}
```

### 3. Kết quả
Ảnh chữ ký sẽ được render vào vị trí `{%trainer_signature}` với kích thước tự động.

## 🚨 Lưu ý quan trọng

### 1. Syntax khác biệt
- **Text fields**: `{fieldName}`
- **Image fields**: `{%fieldName}` ← Bắt buộc có dấu %

### 2. Performance
- Ảnh URL sẽ được download real-time khi render
- Ảnh lớn sẽ được tự động resize
- Base64 images được xử lý nhanh nhất

### 3. Error Handling
- System sẽ không crash nếu ảnh lỗi
- Check logs để debug image loading issues

## 🧪 Test Cases

### Test Template
Tạo file Word với content:
```
Name: {trainee_name}
Photo: {%trainee_photo}
Signature: {%signature}
```

### Test Data
```json
{
  "trainee_name": "John Doe",
  "trainee_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "signature": "https://example.com/signature.png"
}
```

## 📞 Troubleshooting

### Issue: Ảnh không hiển thị
- ✅ Check syntax: `{%fieldName}` chứ không phải `{fieldName}`
- ✅ Check field type in database: `SIGNATURE_IMG`, `IMAGE`
- ✅ Check URL accessibility nếu dùng external URLs

### Issue: Ảnh bị méo/sai kích thước
- ✅ Module tự động resize, check original image dimensions
- ✅ Adjust max width trong config nếu cần (hiện tại: 300px)

### Issue: Performance chậm
- ✅ Sử dụng base64 thay vì URLs cho ảnh nhỏ
- ✅ Optimize image size trước khi upload

## 🎯 Next Steps

1. ✅ Test với ảnh chữ ký thật
2. ✅ Upload mẫu template có ảnh
3. ✅ Test với different image formats (PNG, JPG, etc.)
4. ✅ Monitor performance với large images