// Node's SQLite errors use ERR_SQLITE_ERROR plus a numeric (possibly extended) result code.
export function storageError(error){
 const sqlite=Number.isInteger(error?.errcode)?error.errcode&255:undefined,code=error?.code;
 if(['ENOSPC','EDQUOT','SQLITE_FULL'].includes(code)||sqlite===13)return {status:507,code:'STORAGE_FULL',error:'Không đủ dung lượng để lưu. Hãy giải phóng dung lượng ổ đĩa rồi thử lại; giữ nguyên nháp hiện tại.'};
 if(['EROFS','EACCES','EPERM','SQLITE_READONLY'].includes(code)||sqlite===8)return {status:503,code:'STORAGE_READONLY',error:'Không thể ghi vào nơi lưu dữ liệu. Hãy kiểm tra quyền ghi hoặc chế độ chỉ đọc rồi thử lại; giữ nguyên nháp hiện tại.'};
 if(['EIO','SQLITE_IOERR'].includes(code)||sqlite===10)return {status:500,code:'STORAGE_IO_ERROR',error:'Thiết bị lưu trữ gặp lỗi khi đọc hoặc ghi. Hãy kiểm tra ổ đĩa trước khi thử lại; giữ nguyên nháp hiện tại.'};
 return null;
}
