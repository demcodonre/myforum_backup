#!/bin/bash

# MongoDB 7.0 认证备份脚本
# 适用于 mongosh 2.5+

# 配置部分
MONGODB_URI="mongodb://admin:Qwer1234@localhost:27017/myforum?authSource=admin"
BACKUP_ROOT="/backup/mongodb"
MAX_DAYS=30
COMPRESS_LEVEL=9
LOG_FILE="/var/log/mongodb/backup.log"

# 创建目录
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# 开始备份
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 开始 MongoDB 备份" >> "$LOG_FILE"

# 使用 mongodump 备份
mongodump \
  --uri="$MONGODB_URI" \
  --out="$BACKUP_DIR" \
  --gzip \
  2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
  # 压缩备份
  tar -czvf "$BACKUP_DIR.tar.gz" -C "$BACKUP_ROOT" "$TIMESTAMP" --remove-files
  
  # 清理旧备份
  find "$BACKUP_ROOT" -name "*.tar.gz" -mtime +$MAX_DAYS -delete
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] 备份成功: $BACKUP_DIR.tar.gz" >> "$LOG_FILE"
  exit 0
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] 备份失败!" >> "$LOG_FILE"
  rm -rf "$BACKUP_DIR"
  exit 1
fi