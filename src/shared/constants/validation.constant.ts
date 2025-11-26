//DEFAULT

// Cho phép chữ cái, dấu câu thông dụng và khoảng trắng (dùng chung cho tên)
export const NAME_REGEX = /^[\p{L}\p{P}\s]+$/u

// Cho phép số điện thoại 9-15 chữ số với tuỳ chọn dấu +, khoảng trắng, dấu ., -, ()
export const PHONE_NUMBER_REGEX = /^\+?(?:\d[\s().-]?){8,14}\d$/

// Cho phép mọi ký tự chữ (Letter) theo chuẩn Unicode
export const LETTER_REGEX = /\p{L}/u

// Cho phép chữ, số, khoảng trắng và một số ký tự dấu phổ biến trong mô tả
export const BASIC_TEXT_REGEX = /^[\p{L}\p{N}\s.,'’\-_/()]+$/u

// Cho phép chữ, số, khoảng trắng, gạch ngang, gạch dưới và dấu slash (dùng cho mã)
export const CODE_TEXT_REGEX = /^[\p{L}\p{N}\s\-_/]+$/u

// Cho phép chữ, số, khoảng trắng và dấu gạch ngang (dùng cho số hộ chiếu)
export const PASSPORT_REGEX = /^[\p{L}\p{N}\s-]+$/u

// Cho phép tên quốc gia với chữ cái và các dấu phân cách đơn giản
export const COUNTRY_REGEX = /^[\p{L}\s'.-]+$/u
