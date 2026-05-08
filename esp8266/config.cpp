#include "config.h"

const Source sources[] = {
  {1, "IN1", "input"}, {2, "IN2", "input"}, {3, "IN3", "input"}, {4, "IN4", "input"},
  {4001, "IN5", "input"}, {4002, "IN6", "input"}, {4003, "IN7", "input"}, {4004, "IN8", "input"},
  {3010, "MP1", "media"}, {3020, "MP2", "media"}, {5001, "M/SRC", "media"},
};
const int sourceCount = 11;

const Command commands[] = {
  {"pgmIndex", "pgmIndex", "set", {0}, 1},
  {"pvwIndex", "pvwIndex", "set", {0}, 1},
  {"cutTransition", "cutTransition", "set", {0}, 0},
  {"autoTransition", "autoTransition", "set", {0}, 0},
  {"transitionStyleMix", "transitionStyle", "set", {0}, 0},
  {"transitionStyleDip", "transitionStyle", "set", {1}, 1},
  {"transitionStyleWipe", "transitionStyle", "set", {2}, 1},
  {"nextTransitionBG", "nextTransition", "set", {0}, 1},
  {"nextTransitionBGKey", "nextTransition", "set", {0, 1}, 2},
  {"keyOnAir0On", "keyOnAir", "set", {0, 1}, 2},
  {"keyOnAir0Off", "keyOnAir", "set", {0, 0}, 2},
  {"dsk1OnAirOn", "dskOnAir", "set", {0, 1}, 2},
  {"dsk1OnAirOff", "dskOnAir", "set", {0, 0}, 2},
  {"dsk2OnAirOn", "dskOnAir", "set", {1, 1}, 2},
  {"dsk2OnAirOff", "dskOnAir", "set", {1, 0}, 2},
  {"recordStart", "recordStart", "set", {0}, 1},
  {"recordStartISO", "recordStart", "set", {1}, 1},
  {"recordStop", "recordStop", "set", {0}, 0},
  {"ftb", "ftb", "set", {0}, 0},
  {"playToggle0", "playPause", "set", {0, 1}, 2},
  {"playToggle1", "playPause", "set", {1, 1}, 2},
  {"playPrev0", "playPrev", "set", {0}, 1},
  {"playNext0", "playNext", "set", {0}, 1},
  {"playPrev1", "playPrev", "set", {1}, 1},
  {"playNext1", "playNext", "set", {1}, 1},
  {"liveStreamEnable0On", "liveStreamOutputEnable", "set", {0, 1}, 2},
  {"liveStreamEnable0Off", "liveStreamOutputEnable", "set", {0, 0}, 2},
  {"liveStreamEnable1On", "liveStreamOutputEnable", "set", {1, 1}, 2},
  {"liveStreamEnable1Off", "liveStreamOutputEnable", "set", {1, 0}, 2},
  {"liveStreamEnable2On", "liveStreamOutputEnable", "set", {2, 1}, 2},
  {"liveStreamEnable2Off", "liveStreamOutputEnable", "set", {2, 0}, 2},
  {"liveGo", "live", "set", {0}, 0},
};
const int commandCount = 32;

const char* const handshakeSequence[] = {"version", "buildInfo", "deviceId", "deviceType", "deviceName"};
const int handshakeCount = 5;

const char* const statusQueries[] = {"pgmTally", "pvwTally", "recordStatus", "playStatus", "liveStreamOutputStatus", "transitionStyle"};
const int statusQueryCount = 6;

const char* const pushEvents[] = {
  "pgmIndex", "pvwIndex", "pgmTally", "pvwTally",
  "recordStatus", "recordDuration", "recordFree",
  "playStatus", "playProgress", "playFileName", "playGroups", "playCount",
  "liveStreamOutputStatus", "liveStreamOutputProfile",
  "liveStreamOutputUrl", "liveStreamOutputKey", "liveStreamOutputServiceName",
  "transitionStatus", "transitionStyle",
  "ftbStatus", "keyOnAir", "dskOnAir",
  "audioMeter", "version", "buildInfo", "deviceId", "deviceType", "deviceName", "shortName"
};
const int pushEventCount = 29;
