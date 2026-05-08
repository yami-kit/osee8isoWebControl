#include "protocol.h"

uint16_t Protocol::crc16Modbus(const uint8_t* data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

size_t Protocol::buildFrame(const char* json, uint8_t* buffer, size_t bufferSize) {
  size_t jsonLen = strlen(json);
  size_t lenValue = jsonLen + 1 + 2;
  size_t frameBodyLen = 2 + 2 + 1 + jsonLen + 1;
  size_t totalLen = frameBodyLen + 2;

  if (totalLen > bufferSize) return 0;

  size_t offset = 0;
  buffer[offset++] = 0xEB;
  buffer[offset++] = 0xA6;
  buffer[offset++] = (lenValue >> 8) & 0xFF;
  buffer[offset++] = lenValue & 0xFF;
  buffer[offset++] = 0x00;

  memcpy(buffer + offset, json, jsonLen);
  offset += jsonLen;

  buffer[offset++] = 0x0A;

  uint16_t crc = crc16Modbus(buffer, offset);
  buffer[offset++] = crc & 0xFF;
  buffer[offset++] = (crc >> 8) & 0xFF;

  return offset;
}

size_t Protocol::buildCommand(const char* id, const char* cmdType, const int* value, int valueCount, uint8_t* buffer, size_t bufferSize) {
  char json[384];
  int pos = snprintf(json, sizeof(json), "{\"id\":\"%s\",\"type\":\"%s\",\"value\":[", id, cmdType);
  for (int i = 0; i < valueCount; i++) {
    if (i > 0) pos += snprintf(json + pos, sizeof(json) - pos, ",");
    pos += snprintf(json + pos, sizeof(json) - pos, "%d", value[i]);
  }
  pos += snprintf(json + pos, sizeof(json) - pos, "]}");
  return buildFrame(json, buffer, bufferSize);
}

size_t Protocol::buildHeartbeat(uint8_t* buffer, size_t bufferSize) {
  return buildCommand("audioMeter", "get", nullptr, 0, buffer, bufferSize);
}

int Protocol::parseFrames(const uint8_t* data, size_t length, char* jsonOut, size_t jsonOutSize, size_t* consumed) {
  *consumed = 0;
  size_t pos = 0;

  while (pos < length) {
    if (pos + 1 < length && data[pos] == 0xEB && data[pos + 1] == 0xA6) {
      if (pos + 4 > length) break;
      uint16_t lenValue = (data[pos + 2] << 8) | data[pos + 3];
      size_t frameLen = 2 + 2 + 1 + lenValue;

      if (pos + frameLen > length) break;

      size_t jsonStart = 5;
      size_t jsonEnd = frameLen - 3;

      if (jsonEnd > jsonStart && (jsonEnd - jsonStart) < jsonOutSize) {
        size_t jsonLen = jsonEnd - jsonStart;
        memcpy(jsonOut, data + pos + jsonStart, jsonLen);
        jsonOut[jsonLen] = '\0';
        *consumed = pos + frameLen;
        return 1;
      }

      pos += frameLen;
    } else if (data[pos] == 0x00) {
      *consumed = pos + 1;
      strlcpy(jsonOut, "{\"_type\":\"heartbeat\"}", jsonOutSize);
      return 1;
    } else {
      pos++;
    }
  }

  return 0;
}

void Protocol::bufferToHex(const uint8_t* buf, size_t len, char* hexOut, size_t hexOutSize) {
  size_t pos = 0;
  for (size_t i = 0; i < len && pos + 3 < hexOutSize; i++) {
    pos += snprintf(hexOut + pos, hexOutSize - pos, "%02X:", buf[i]);
  }
  if (pos > 0) hexOut[pos - 1] = '\0';
}

size_t Protocol::hexToBuffer(const char* hexStr, uint8_t* buf, size_t bufSize) {
  size_t count = 0;
  while (*hexStr && count < bufSize) {
    while (*hexStr == ':' || *hexStr == ' ' || *hexStr == '-') hexStr++;
    if (!*hexStr || !*(hexStr + 1)) break;
    char byteStr[3] = {hexStr[0], hexStr[1], 0};
    buf[count++] = (uint8_t)strtol(byteStr, nullptr, 16);
    hexStr += 2;
  }
  return count;
}
