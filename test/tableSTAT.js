import * as fontkit from 'fontkit';
import assert from 'assert';
import * as r from 'restructure';

import tableSTAT from '../src/tables/STAT.js';
import tables from '../src/tables/index.js';

// We have sample binary data from four different early examples of
// font files demonstrating font variations.  These exercise some of
// the STAT structure formats.

// Sample from "Selawik-variable.ttf"   (SIL OFL license)
//    - has both Design Axes and Axis Values

// Sample from "TestGVAREight.ttf"
//    - has non-standard design axis tag names
//    - has format 2 Axis Values

// Sample from "AmstelvarAlpha-VF.ttf"
//    - has obsolete STAT table format 0x00010000
//    - does not have any Axis Values
//    - rounds up length adding trailing 0x0000

// Sample from "Decovar-VF.ttf"
//    - has obsolete STAT table format 0x00010000
//    - has 15(!) design axes with non-standard names
//    - does not have any Axis Values

// STAT table sample from Selawik-variable.ttf
// https://github.com/unicode-org/text-rendering-tests/blob/master/fonts/Selawik-variable.ttf

//  As dumped:
//      STAT  0xECB0D1A2      120    98924  001826C
//      TSI0  0xCC020E14     3112    99044  00182E4
//  0018260:                               0001 0001  ......... ......
//  0018270: 0008 0002 0000 0014 0006 0000 0024 0103  .............$..
//  0018280: 6974 616c 0100 0001 7767 6874 0100 0000  ital....wght....
//  0018290: 000c 0018 0024 0030 003c 0048 0001 0000  .....$.0.<.H....
//  00182a0: 0002 0103 0000 0000 0001 0001 0000 0101  ................
//  00182b0: 012c 0000 0001 0001 0000 0102 015e 0000  .,...........^..
//  00182c0: 0001 0001 0000 0103 0190 0000 0001 0001  ................
//  00182d0: 0000 0104 0258 0000 0001 0001 0000 0105  .....X..........
//  00182e0: 02bc 0000 0000 0050 0000 0000 0001 00dc  .......P........

// That dump exploded and annotated:

let inputSTATTable01 = [
  // 0000
  0x00, 0x01, 0x00, 0x01, // 0000 Version
  0x00, 0x08, // 0004 uint16  designAxisSize
  0x00, 0x02, // 0006 uint16  designAxisCount
  0x00, 0x00, 0x00, 0x14, // 0008 LOffset offsetToDesignAxes
  0x00, 0x06, // 000C uint16  axisValueCount
  0x00, 0x00, 0x00, 0x24, // 000E LOffset offsetToAxisValueOffsets
  0x01, 0x03, // 0012 uint16/NameID elidedFallbackNameID
  // 0014         designAxes[2]
  0x69, 0x74, 0x61, 0x6c, // 0000 [0] Tag     axisTag       'ital'
  0x01, 0x00, // 0004 [0] uint16  axisNameID
  0x00, 0x01, // 0006 [0] uint16  axisOrdering
  0x77, 0x67, 0x68, 0x74, // 0008 [1] Tag     axisTag       'wght'
  0x01, 0x00, // 000C [1] uint16  axisNameID
  0x00, 0x00, // 000E [1] uint16  axisOrdering
  // 0024         Offset  axisValueOffsets[6]
  0x00, 0x0c, // 0000   axisValueOffsets[0]
  0x00, 0x18, // 0002   axisValueOffsets[1]
  0x00, 0x24, // 0004   axisValueOffsets[2]
  0x00, 0x30, // 0006   axisValueOffsets[3]
  0x00, 0x3c, // 0008   axisValueOffsets[4]
  0x00, 0x48, // 000A   axisValueOffsets[5]
  // 0030  000C   axisValue[0]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x00, // 0002     uint16  axisIndex
  0x00, 0x02, // 0004     uint16  flags
  0x01, 0x03, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  value  0.0
  // 003C  0018   axisValue[1]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x01, // 0006     uint16  valueNameID
  0x01, 0x2c, 0x00, 0x00, // 0008     Fixed(16.16)  value  300.0
  // 0048  0024   axisValue[2]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x02, // 0006     uint16  valueNameID
  0x01, 0x5e, 0x00, 0x00, // 0008     Fixed(16.16)  value  350.0
  // 0054  0030   axisValue[3]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x03, // 0006     uint16  valueNameID
  0x01, 0x90, 0x00, 0x00, // 0008     Fixed(16.16)  value  400.0
  // 0060  003C   axisValue[4]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x04, // 0006     uint16  valueNameID
  0x02, 0x58, 0x00, 0x00, // 0008     Fixed(16.16)  value  600.0
  // 006C  0048   axisValue[5]
  0x00, 0x01, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x05, // 0006     uint16  valueNameID
  0x02, 0xbc, 0x00, 0x00 // 0008     Fixed(16.16)  value  700.0
]; // 0078

// The object as expected from successful parsing of above data

let expectedSTATTable01 = {
  version: 0x00010001, // s.b. "Version" or "majorVersion"/"minorVersion"
  designAxisSize: 8,
  designAxisCount: 2,
  offsetToDesignAxes: [
    { axisTag: 'ital', // 'ital'   1769234796
      axisNameID: 256,
      axisOrdering: 1
    },
    { axisTag: 'wght', // 'wght'   2003265652
      axisNameID: 256,
      axisOrdering: 0
    }
  ],
  axisValueCount: 6,
  offsetToAxisValueOffsets: {
    axisValues: [
      { version: 1, // s.b. "Format"
        axisIndex: 0,
        flags: 2,
        valueNameID: 259,
        value: 0 //    0.0   0
      },
      { version: 1,
        axisIndex: 1,
        flags: 0,
        valueNameID: 257,
        value: 300.0 //  300.0   19660800
      },
      { version: 1,
        axisIndex: 1,
        flags: 0,
        valueNameID: 258,
        value: 350.0 //  350.0   22937600
      },
      { version: 1,
        axisIndex: 1,
        flags: 0,
        valueNameID: 259,
        value: 400.0 //  400.0   26214400
      },
      { version: 1,
        axisIndex: 1,
        flags: 0,
        valueNameID: 260,
        value: 600.0 //  600.0   39321600
      },
      { version: 1,
        axisIndex: 1,
        flags: 0,
        valueNameID: 261,
        value: 700.0 //  700.0   45875200
      }
    ]
  },
  elidedFallbackNameID: 259
};

// STAT table sample from TestGVAREight.ttf
// https://github.com/unicode-org/text-rendering-tests/blob/master/fonts/TestGVAREight.ttf

//  As dumped:
//      STAT  0xB31CC7E2      200     3572  0000DF4
//      fvar  0xAE144701      192     3772  0000EBC
//  0000df0:           0001 0001 0008 0006 0000 0014  l...............
//  0000e00: 0006 0000 0044 0002 4252 2020 010c 0002  .....D..BR  ....
//  0000e10: 434b 2020 0109 0000 434e 2020 010b 0001  CK  ....CN  ....
//  0000e20: 4652 2020 010d 0003 4856 2020 010e 0004  FR  ....HV  ....
//  0000e30: 5443 2020 010f 0005 000c 0020 0034 0048  TC  ....... .4.H
//  0000e40: 005c 0070 0002 0000 0000 0104 0000 0000  .\.p............
//  0000e50: 0000 0000 0001 0000 0002 0001 0000 0100  ................
//  0000e60: 0000 0000 ffff 0000 0001 0000 0002 0002  ................
//  0000e70: 0000 0103 0000 0000 ffff 0000 0000 0000  ................
//  0000e80: 0002 0003 0000 0101 0000 0000 ffff 0000  ................
//  0000e90: 0001 0000 0002 0004 0000 0102 0000 0000  ................
//  0000ea0: ffff 0000 0001 0000 0002 0005 0000 0105  ................
//  0000eb0: 0000 0000 0000 0000 0001 0000

// That dump exploded and annotated:

let inputSTATTable02 = [
  // 0000
  0x00, 0x01, 0x00, 0x01, // 0000 Version
  0x00, 0x08, // 0004 uint16  designAxisSize
  0x00, 0x06, // 0006 uint16  designAxisCount
  0x00, 0x00, 0x00, 0x14, // 0008 LOffset offsetToDesignAxes
  0x00, 0x06, // 000C uint16  axisValueCount
  0x00, 0x00, 0x00, 0x44, // 000E LOffset offsetToAxisValueOffsets
  0x00, 0x02, // 0012 uint16/NameID elidedFallbackNameID
  // 0014         designAxes[0]
  0x42, 0x52, 0x20, 0x20, // 0000 [0] Tag     axisTag       'BR  '
  0x01, 0x0c, // 0004 [0] uint16  axisNameID
  0x00, 0x02, // 0006 [0] uint16  axisOrdering
  // 001C         designAxes[1]
  0x43, 0x4b, 0x20, 0x20, // 0000 [0] Tag     axisTag       'CK  '
  0x01, 0x09, // 0004 [0] uint16  axisNameID
  0x00, 0x00, // 0006 [0] uint16  axisOrdering
  // 0024         designAxes[2]
  0x43, 0x4e, 0x20, 0x20, // 0000 [0] Tag     axisTag       'CN  '
  0x01, 0x0b, // 0004 [0] uint16  axisNameID
  0x00, 0x01, // 0006 [0] uint16  axisOrdering
  // 002C         designAxes[3]
  0x46, 0x52, 0x20, 0x20, // 0000 [0] Tag     axisTag       'FR  '
  0x01, 0x0d, // 0004 [0] uint16  axisNameID
  0x00, 0x03, // 0006 [0] uint16  axisOrdering
  // 0034         designAxes[4]
  0x48, 0x56, 0x20, 0x20, // 0000 [0] Tag     axisTag       'HV  '
  0x01, 0x0e, // 0004 [0] uint16  axisNameID
  0x00, 0x04, // 0006 [0] uint16  axisOrdering
  // 003C         designAxes[5]
  0x54, 0x43, 0x20, 0x20, // 0000 [0] Tag     axisTag       'TC  '
  0x01, 0x0f, // 0004 [0] uint16  axisNameID
  0x00, 0x05, // 0006 [0] uint16  axisOrdering
  // 0044         Offset  axisValueOffsets[6]
  0x00, 0x0c, // 0000   axisValueOffsets[0]
  0x00, 0x20, // 0002   axisValueOffsets[1]
  0x00, 0x34, // 0004   axisValueOffsets[2]
  0x00, 0x48, // 0006   axisValueOffsets[3]
  0x00, 0x5c, // 0008   axisValueOffsets[4]
  0x00, 0x70, // 000A   axisValueOffsets[5]
  // 0050  000C   axisValue[0]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x00, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x04, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue   0.0
  0x00, 0x00, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue  0.0
  0x00, 0x01, 0x00, 0x00, // 0010     Fixed(16.16)  rangeMaxValue  1.0
  // 0064  0014   axisValue[1]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x01, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x00, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue    0.0
  0xff, 0xff, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue  -1.0
  0x00, 0x01, 0x00, 0x00, // 0010     Fixed(16.16)  rangeMaxValue   1.0
  // 0078  00xx   axisValue[2]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x02, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x03, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue    0.0
  0xff, 0xff, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue  -1.0
  0x00, 0x00, 0x00, 0x00, // 0010     Fixed(16.16)  rangeMaxValue   0.0
  // 008C  00xx   axisValue[3]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x03, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x01, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue    0.0
  0xff, 0xff, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue  -1.0
  0x00, 0x01, 0x00, 0x00, // 0010     Fixed(16.16)  rangeMaxValue   1.0
  // 00A0  00xx   axisValue[4]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x04, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x02, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue    0.0
  0xff, 0xFf, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue  -1.0
  0x00, 0x01, 0x00, 0x00, // 0010     Fixed(16.16)  rangeMaxValue   1.0
  // 00B4  00xx   axisValue[5]
  0x00, 0x02, // 0000     uint16  format
  0x00, 0x05, // 0002     uint16  axisIndex
  0x00, 0x00, // 0004     uint16  flags
  0x01, 0x05, // 0006     uint16  valueNameID
  0x00, 0x00, 0x00, 0x00, // 0008     Fixed(16.16)  nominalValue    0.0
  0x00, 0x00, 0x00, 0x00, // 000C     Fixed(16.16)  rangeMinValue   0.0
  0x00, 0x01, 0x00, 0x00 // 0010     Fixed(16.16)  rangeMaxValue   1.0
]; // 00C8

// The object as expected from successful parsing of above data

let expectedSTATTable02 = {
  version: 0x00010001, // s.b. "Version" or "majorVersion"/"minorVersion"
  designAxisSize: 8,
  designAxisCount: 6,
  offsetToDesignAxes: [
    { axisTag: 'BR  ',
      axisNameID: 268,
      axisOrdering: 2
    },
    { axisTag: 'CK  ',
      axisNameID: 265,
      axisOrdering: 0
    },
    { axisTag: 'CN  ',
      axisNameID: 267,
      axisOrdering: 1
    },
    { axisTag: 'FR  ',
      axisNameID: 269,
      axisOrdering: 3
    },
    { axisTag: 'HV  ',
      axisNameID: 270,
      axisOrdering: 4
    },
    { axisTag: 'TC  ',
      axisNameID: 271,
      axisOrdering: 5
    }
  ],
  axisValueCount: 6,
  offsetToAxisValueOffsets: {
    axisValues: [
      { version: 2,
        axisIndex: 0,
        flags: 0,
        valueNameID: 260,
        nominalValue: 0,
        rangeMinValue: 0,
        rangeMaxValue: 1 },
      { version: 2,
        axisIndex: 1,
        flags: 0,
        valueNameID: 256,
        nominalValue: 0,
        rangeMinValue: -1,
        rangeMaxValue: 1 },
      { version: 2,
        axisIndex: 2,
        flags: 0,
        valueNameID: 259,
        nominalValue: 0,
        rangeMinValue: -1,
        rangeMaxValue: 0 },
      { version: 2,
        axisIndex: 3,
        flags: 0,
        valueNameID: 257,
        nominalValue: 0,
        rangeMinValue: -1,
        rangeMaxValue: 1 },
      { version: 2,
        axisIndex: 4,
        flags: 0,
        valueNameID: 258,
        nominalValue: 0,
        rangeMinValue: -1,
        rangeMaxValue: 1 },
      { version: 2,
        axisIndex: 5,
        flags: 0,
        valueNameID: 261,
        nominalValue: 0,
        rangeMinValue: 0,
        rangeMaxValue: 1
      }
    ]
  },
  elidedFallbackNameID: 2
};

// STAT table sample from AmstelvarAlpha-VF.ttf
//    https://github.com/TypeNetwork/fb-Amstelvar/blob/master/fonts/AmstelvarAlpha-VF.ttf

//  As dumped:
//      STAT  0x24356B66       90    15864  0003DF8
//      fvar  0x755C2D67      196    15956  0003E54
//  0003df0:                     0001 0000 0008 0009          ........
//  0003e00: 0000 0012 0000 0000 0000 7767 6874 0100  ..........wght..
//  0003e10: 0000 7764 7468 0101 0001 6f70 737a 0102  ..wdth....opsz..
//  0003e20: 0002 584f 5051 0103 0003 5854 5241 0104  ..XOPQ....XTRA..
//  0003e30: 0004 594f 5051 0105 0005 5954 4c43 0106  ..YOPQ....YTLC..
//  0003e40: 0006 5954 5345 0107 0007 4752 4144 0108  ..YTSE....GRAD..
//  0003e50: 0008 0000                                ....
//                ^^^^ is this just rounding up to quad byte boundary?

// That dump exploded and annotated:

let inputSTATTable03 = [
  // 0000
  0x00, 0x01, 0x00, 0x00, // 0000 Version
  0x00, 0x08, // 0004 uint16  designAxisSize
  0x00, 0x09, // 0006 uint16  designAxisCount
  0x00, 0x00, 0x00, 0x12, // 0008 LOffset offsetToDesignAxes
  //        No Axis Values here
  0x00, 0x00, // 000C uint16  axisValueCount
  0x00, 0x00, 0x00, 0x00, // 000E LOffset offsetToAxisValueOffsets
  // missing << uint16/NameID elidedFallbackNameID >>
  // 0012         designAxes[9]
  0x77, 0x67, 0x68, 0x74, // 0000 [0] Tag     axisTag       'wght'
  0x01, 0x00, // 0004 [0] uint16  axisNameID
  0x00, 0x00, // 0006 [0] uint16  axisOrdering
  0x77, 0x64, 0x74, 0x68, // 0000 [1] Tag     axisTag       'wdth'
  0x01, 0x01, // 0004 [1] uint16  axisNameID
  0x00, 0x01, // 0006 [1] uint16  axisOrdering
  0x6f, 0x70, 0x73, 0x7a, // 0000 [2] Tag     axisTag       'opsz'
  0x01, 0x02, // 0004 [2] uint16  axisNameID
  0x00, 0x02, // 0006 [2] uint16  axisOrdering
  0x58, 0x4f, 0x50, 0x51, // 0000 [3] Tag     axisTag       'XOPQ'
  0x01, 0x03, // 0004 [3] uint16  axisNameID
  0x00, 0x03, // 0006 [3] uint16  axisOrdering
  0x58, 0x54, 0x52, 0x41, // 0000 [4] Tag     axisTag       'XTRA'
  0x01, 0x04, // 0004 [4] uint16  axisNameID
  0x00, 0x04, // 0006 [4] uint16  axisOrdering
  0x59, 0x4f, 0x50, 0x51, // 0000 [5] Tag     axisTag       'YOPQ'
  0x01, 0x05, // 0004 [5] uint16  axisNameID
  0x00, 0x05, // 0006 [5] uint16  axisOrdering
  0x59, 0x54, 0x4c, 0x43, // 0000 [6] Tag     axisTag       'YTLC'
  0x01, 0x06, // 0004 [6] uint16  axisNameID
  0x00, 0x06, // 0006 [6] uint16  axisOrdering
  0x59, 0x54, 0x53, 0x45, // 0000 [7] Tag     axisTag       'YTSE'
  0x01, 0x07, // 0004 [7] uint16  axisNameID
  0x00, 0x07, // 0006 [7] uint16  axisOrdering
  0x47, 0x52, 0x41, 0x44, // 0000 [8] Tag     axisTag       'GRAD'
  0x01, 0x08, // 0004 [8] uint16  axisNameID
  0x00, 0x08, // 0006 [8] uint16  axisOrdering
  // 005A
  0x00, 0x00 // is this just rounding up to quad byte boundary?
]; // 005C

// The object as expected from successful parsing of above data

let expectedSTATTable03 = {
  version: 0x00010000, // an older obsolete version!
  designAxisSize: 8,
  designAxisCount: 9,
  offsetToDesignAxes: [
    { axisTag: 'wght',
      axisNameID: 256,
      axisOrdering: 0
    },
    { axisTag: 'wdth',
      axisNameID: 257,
      axisOrdering: 1
    },
    { axisTag: 'opsz',
      axisNameID: 258,
      axisOrdering: 2
    },
    { axisTag: 'XOPQ',
      axisNameID: 259,
      axisOrdering: 3
    },
    { axisTag: 'XTRA',
      axisNameID: 260,
      axisOrdering: 4
    },
    { axisTag: 'YOPQ',
      axisNameID: 261,
      axisOrdering: 5
    },
    { axisTag: 'YTLC',
      axisNameID: 262,
      axisOrdering: 6
    },
    { axisTag: 'YTSE',
      axisNameID: 263,
      axisOrdering: 7
    },
    { axisTag: 'GRAD',
      axisNameID: 264,
      axisOrdering: 8
    }
  ],
  axisValueCount: 0,
  offsetToAxisValueOffsets: null

  // This deprecated version does not have this field:
  //    "elidedFallbackNameID": nnn,
};

// STAT table sample from Decovar-VF.ttf
//    https://github.com/TypeNetwork/fb-Decovar/blob/master/fonts/Decovar-VF.ttf

//  As dumped:
//      STAT  0xB2921842      138    54224  000D3D0
//      fvar  0xD0B4C150     1404    54364  000D45C
//  000d3d0: 0001 0000 0008 000f 0000 0012 0000 0000  ................
//  000d3e0: 008a 494e 4c4e 0100 0001 5349 4e4c 0101  ..INLN....SINL..
//  000d3f0: 0003 5353 5452 0102 0005 5357 524d 0103  ..SSTR....SWRM..
//  000d400: 0004 5442 4946 0104 000c 5446 4c52 0105  ..TBIF....TFLR..
//  000d410: 000b 5449 4e4c 0106 0008 544f 494c 0107  ..TINL....TOIL..
//  000d420: 0009 5452 4e44 0108 0006 5452 5342 0109  ..TRND....TRSB..
//  000d430: 000e 5453 4852 010a 0007 5453 4c42 010b  ..TSHR....TSLB..
//  000d440: 000d 5457 524d 010c 000a 574f 524d 010d  ..TWRM....WORM..
//  000d450: 0002 7767 6874 010e 0000 0000            ..wght..........

// That dump exploded and annotated:

let inputSTATTable04 = [
  // 0000
  0x00, 0x01, 0x00, 0x00, // 0000 Version
  0x00, 0x08, // 0004 uint16  designAxisSize
  0x00, 0x0f, // 0006 uint16  designAxisCount
  0x00, 0x00, 0x00, 0x12, // 0008 LOffset offsetToDesignAxes
  0x00, 0x00, // 000C uint16  axisValueCount                === 0
  0x00, 0x00, 0x00, 0x8a, // 000E LOffset offsetToAxisValueOffsets    non-null !
  // 0012         designAxes[15]
  0x49, 0x4e, 0x4c, 0x4e, // 0000 [0] Tag     axisTag       'INLN'
  0x01, 0x00, // 0004 [0] uint16  axisNameID
  0x00, 0x01, // 0006 [0] uint16  axisOrdering
  0x53, 0x49, 0x4e, 0x4c, // 0000 [1] Tag     axisTag       'SINL'
  0x01, 0x01, // 0004 [1] uint16  axisNameID
  0x00, 0x03, // 0006 [1] uint16  axisOrdering
  0x53, 0x53, 0x54, 0x52, // 0000 [2] Tag     axisTag       'SSTR'
  0x01, 0x02, // 0004 [2] uint16  axisNameID
  0x00, 0x05, // 0006 [2] uint16  axisOrdering
  0x53, 0x57, 0x52, 0x4d, 0x01, 0x03, 0x00, 0x04,
  0x54, 0x42, 0x49, 0x46, 0x01, 0x04, 0x00, 0x0c,
  0x54, 0x46, 0x4c, 0x52, 0x01, 0x05, 0x00, 0x0b,
  0x54, 0x49, 0x4e, 0x4c, 0x01, 0x06, 0x00, 0x08,
  0x54, 0x4f, 0x49, 0x4c, 0x01, 0x07, 0x00, 0x09,
  0x54, 0x52, 0x4e, 0x44, 0x01, 0x08, 0x00, 0x06,
  0x54, 0x52, 0x53, 0x42, 0x01, 0x09, 0x00, 0x0e,
  0x54, 0x53, 0x48, 0x52, 0x01, 0x0a, 0x00, 0x07,
  0x54, 0x53, 0x4c, 0x42, 0x01, 0x0b, 0x00, 0x0d,
  0x54, 0x57, 0x52, 0x4d, 0x01, 0x0c, 0x00, 0x0a,
  0x57, 0x4f, 0x52, 0x4d, 0x01, 0x0d, 0x00, 0x02,
  0x77, 0x67, 0x68, 0x74, // 0000 [14] Tag     axisTag       'wght'
  0x01, 0x0e, // 0004 [14] uint16  axisNameID
  0x00, 0x00, // 0006 [14] uint16  axisOrdering
  // 008A
  0x00, 0x00 // is this just rounding up to quad byte boundary?
]; // 008C

// The object as expected from successful parsing of above data

let expectedSTATTable04 = {
  version: 0x00010000, // an older obsolete version!
  designAxisSize: 8,
  designAxisCount: 15,
  offsetToDesignAxes: [
    { axisTag: 'INLN',
      axisNameID: 256,
      axisOrdering: 1
    },
    { axisTag: 'SINL',
      axisNameID: 257,
      axisOrdering: 3
    },
    { axisTag: 'SSTR',
      axisNameID: 258,
      axisOrdering: 5
    },
    { axisTag: 'SWRM',
      axisNameID: 259,
      axisOrdering: 4
    },
    { axisTag: 'TBIF',
      axisNameID: 260,
      axisOrdering: 12
    },
    { axisTag: 'TFLR',
      axisNameID: 261,
      axisOrdering: 11
    },
    { axisTag: 'TINL',
      axisNameID: 262,
      axisOrdering: 8
    },
    { axisTag: 'TOIL',
      axisNameID: 263,
      axisOrdering: 9
    },
    { axisTag: 'TRND',
      axisNameID: 264,
      axisOrdering: 6
    },
    { axisTag: 'TRSB',
      axisNameID: 265,
      axisOrdering: 14
    },
    { axisTag: 'TSHR',
      axisNameID: 266,
      axisOrdering: 7
    },
    { axisTag: 'TSLB',
      axisNameID: 267,
      axisOrdering: 13
    },
    { axisTag: 'TWRM',
      axisNameID: 268,
      axisOrdering: 10
    },
    { axisTag: 'WORM',
      axisNameID: 269,
      axisOrdering: 2
    },
    { axisTag: 'wght',
      axisNameID: 270,
      axisOrdering: 0
    }
  ],
  axisValueCount: 0,
  offsetToAxisValueOffsets: {
    axisValues: []
  }
};

// -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -

describe('Opentype STAT table', function () {
  function decodeSTAT(bytes) {
    return tables.STAT.decode(new r.DecodeStream(Buffer.from(bytes)));
  }

  describe('Decode sample from Selawik-variable.ttf (sample 1)', function () {
    it('decode result matches expected data', function () {
      assert.deepEqual(decodeSTAT(inputSTATTable01), expectedSTATTable01);
    });
  });

  describe('Decode sample from TestGVAREight.ttf (sample 2)', function () {
    it('decode result matches expected data', function () {
      assert.deepEqual(decodeSTAT(inputSTATTable02), expectedSTATTable02);
    });
  });

  describe('Decode sample from AmstelvarAlpha-VF.ttf (sample 3)', function () {
    it('decode result matches expected data', function () {
      assert.deepEqual(decodeSTAT(inputSTATTable03), expectedSTATTable03);
    });
  });

  describe('Decode sample from Decovar-VF.ttf (sample 4)', function () {
    it('decode result matches expected data', function () {
      assert.deepEqual(decodeSTAT(inputSTATTable04), expectedSTATTable04);
    });
  });

  describe('Decode STAT table from font file', function () {
    let font = fontkit.openSync(new URL('data/Selawik-variable/Selawik-variable.ttf', import.meta.url));

    it('font has decoded STAT table', function () {
      assert.ok(font.directory.tables.STAT);
    });

    it('font STAT table matches expected data', function () {
      assert.deepEqual(font.STAT, expectedSTATTable01);
    });
  });

  describe('Encode STAT table to binary', function () {
    it('encode binary result matches original input data', function () {
      let size = tableSTAT.size(expectedSTATTable01);
      let buf = Buffer.alloc(size);
      let stream = new r.EncodeStream(buf);
      tableSTAT.encode(stream, expectedSTATTable01);
      assert.deepEqual([...buf], inputSTATTable01);
    });
  });

  // Synthetic coverage for STAT 1.2 + AxisValue formats 3 and 4 + designAxisSize stride.
  describe('STAT 1.2, format 3/4, and designAxisSize stride', function () {
    // Minimal v1.2 table: 2 axes (stride 10), format 3 + format 4 (2-axis combo).
    // Layout:
    //   0x00 header
    //   0x14 axes[2] @ 10 bytes each → ends 0x28
    //   0x28 offsets [0x0004, 0x0014]
    //   0x2C format3 (16 bytes) → ends 0x3C
    //   0x3C format4 with 2 AxisValue records (20 bytes)
    let inputSTAT12 = [
      0x00, 0x01, 0x00, 0x02, // version 1.2
      0x00, 0x0a, // designAxisSize = 10
      0x00, 0x02, // designAxisCount
      0x00, 0x00, 0x00, 0x14, // offsetToDesignAxes
      0x00, 0x02, // axisValueCount
      0x00, 0x00, 0x00, 0x28, // offsetToAxisValueOffsets
      0x00, 0x02, // elidedFallbackNameID
      // 0x14 designAxes[0]
      0x77, 0x67, 0x68, 0x74, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, // wght + pad
      // 0x1E designAxes[1]
      0x77, 0x64, 0x74, 0x68, 0x01, 0x01, 0x00, 0x01, 0x00, 0x00, // wdth + pad
      // 0x28 axisValueOffsets[2]
      0x00, 0x04,
      0x00, 0x14,
      // 0x2C format 3
      0x00, 0x03,
      0x00, 0x00,
      0x00, 0x00,
      0x01, 0x00,
      0x01, 0x90, 0x00, 0x00, // value 400
      0x02, 0xbc, 0x00, 0x00, // linkedValue 700
      // 0x3C format 4
      0x00, 0x04,
      0x00, 0x02, // axisCount
      0x00, 0x00,
      0x01, 0x01,
      0x00, 0x00, 0x01, 0x90, 0x00, 0x00, // axis 0 = 400
      0x00, 0x01, 0x00, 0x64, 0x00, 0x00 // axis 1 = 100
    ];

    let expectedSTAT12 = {
      version: 0x00010002,
      designAxisSize: 10,
      designAxisCount: 2,
      offsetToDesignAxes: [
        { axisTag: 'wght', axisNameID: 256, axisOrdering: 0 },
        { axisTag: 'wdth', axisNameID: 257, axisOrdering: 1 }
      ],
      axisValueCount: 2,
      offsetToAxisValueOffsets: {
        axisValues: [
          {
            version: 3,
            axisIndex: 0,
            flags: 0,
            valueNameID: 256,
            value: 400,
            linkedValue: 700
          },
          {
            version: 4,
            axisCount: 2,
            flags: 0,
            valueNameID: 257,
            axisValues: [
              { axisIndex: 0, value: 400 },
              { axisIndex: 1, value: 100 }
            ]
          }
        ]
      },
      elidedFallbackNameID: 2
    };

    it('decodes version 1.2 with format 3 and format 4', function () {
      assert.deepEqual(decodeSTAT(inputSTAT12), expectedSTAT12);
    });

    it('round-trips version 1.2 encode/decode', function () {
      let size = tableSTAT.size(expectedSTAT12);
      let buf = Buffer.alloc(size);
      tableSTAT.encode(new r.EncodeStream(buf), expectedSTAT12);
      assert.deepEqual(tableSTAT.decode(new r.DecodeStream(buf)), expectedSTAT12);
    });

    it('skips unknown trailing bytes when designAxisSize > 8', function () {
      // Same as above but designAxisSize padding already covered; assert tag survived pad.
      let decoded = decodeSTAT(inputSTAT12);
      assert.equal(decoded.offsetToDesignAxes[0].axisTag, 'wght');
      assert.equal(decoded.designAxisSize, 10);
    });
  });
});
