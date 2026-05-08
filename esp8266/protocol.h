#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <Arduino.h>
#include <stdint.h>

class Protocol {
public:
  static uint16_t crc16Modbus(const uint8_t* data, size_t length);
  static size_t buildFrame(const char* json, uint8_t* buffer, size_t bufferSize);
  static size_t buildCommand(const char* id, const char* cmdType, const int* value, int valueCount, uint8_t* buffer, size_t bufferSize);
  static size_t buildHeartbeat(uint8_t* buffer, size_t bufferSize);
  static int parseFrames(const uint8_t* data, size_t length, char* jsonOut, size_t jsonOutSize, size_t* consumed);
  static void bufferToHex(const uint8_t* buf, size_t len, char* hexOut, size_t hexOutSize);
  static size_t hexToBuffer(const char* hexStr, uint8_t* buf, size_t bufSize);
};

#endif
