// Node.js script — generates src/data/romansCrossRefs.js
// Run: node scripts/parseRomans.js > src/data/romansCrossRefs.js

const RAW = `1:1 a [Gal. 1:10] b 1 Cor. 1:1; [1 Cor. 9:1; Heb. 5:4]; See 2 Cor. 1:1 c See Acts 13:2
1:2 d Titus 1:2 e ch. 3:21; 16:26; Luke 1:70
1:3 f See Matt. 1:1 g Gal. 4:4
1:4 h [Acts 13:33] i 2 Cor. 13:4; Eph. 1:19, 20; Phil. 3:10; [Acts 10:38; 26:23]
1:5 j ch. 12:3; 15:15 k See Acts 1:25 l ch. 6:16; 16:26; 1 Pet. 1:2; [ch. 15:18; Acts 6:7] m See Acts 9:15
1:6 n Rev. 17:14; [ch. 8:28, 30]
1:7 o 1 Cor. 1:3
1:8 p 1 Cor. 1:4; Eph. 1:15, 16; Phil. 1:3; Col. 1:3, 4; [ch. 6:17; Phil. 4:6; 2 Tim. 1:3] q ch. 16:19; [1 Thess. 1:8]
1:9 r Phil. 1:8; 1 Thess. 2:5, 10; [ch. 9:1; 2 Cor. 1:23; 11:10, 31] s See Acts 24:14 t 2 Tim. 1:3
1:10 u ch. 15:32; [1 Thess. 3:10]
1:11 v ch. 15:22, 23; [Acts 19:21]
1:12 w See 2 Pet. 1:1
1:13 x ch. 15:22, 23; [Acts 19:21] y ch. 15:22; [1 Thess. 2:18] z Phil. 4:17; [John 4:36]
1:14 a 1 Cor. 9:16 b See Acts 28:2
1:16 d [Ps. 40:9, 10]; See Mark 8:38 e 1 Cor. 1:18, 24 f ch. 2:9; See Acts 3:26 g [Mark 7:26]; See John 7:35
1:17 h ch. 3:21; [2 Cor. 5:21; Phil. 3:9] i See ch. 9:30 j Gal. 3:11; Heb. 10:38; Cited from Hab. 2:4
1:18 k Eph. 5:6; Col. 3:6; [ch. 5:9] l [ch. 2:5]
1:19 m ch. 2:14, 15; Acts 14:17; 17:24-27
1:20 n [Ps. 19:1-6; Jer. 5:21, 22]
1:21 o 2 Kgs. 17:15; Jer. 2:5; Eph. 4:17, 18
1:22 p Jer. 10:14; 1 Cor. 1:20
1:23 q Ps. 106:20; Jer. 2:11; [Deut. 4:16-18; Acts 17:29] r 1 Tim. 1:17
1:24 s ver. 26, 28; [Eph. 4:19] t [1 Thess. 4:4]
1:25 u Isa. 28:15; 44:19, 20; Jer. 10:14; Amos 2:4; [2 Thess. 2:11] v ch. 9:5
1:26 w ver. 24, 28 x [Col. 3:5; 1 Thess. 4:5]
1:27 y Lev. 18:22; 20:13
1:28 z ver. 24, 26 a [Jer. 6:30] b [Eph. 5:4]
1:32 c ch. 2:26; 8:4 d ch. 6:21 e Luke 11:48; Acts 8:1; 22:20; [1 Cor. 13:6; 2 Thess. 2:12]
2:1 f ch. 1:20 g 2 Sam. 12:5-7; [John 8:7]; See Matt. 7:2
2:4 h ch. 9:23; 10:12 i ch. 3:25 j ch. 9:22; [Ex. 34:6] k Isa. 30:18; 2 Pet. 3:9, 15; Rev. 2:21
2:5 l [Deut. 32:34]; See James 5:3 m Ps. 110:5
2:6 n Job 34:11; Ps. 62:12; Prov. 24:12; Jer. 17:10; 32:19; See Matt. 16:27
2:7 o See Luke 8:15
2:8 p 2 Thess. 2:12
2:9 q Ezek. 18:20 r See 1 Pet. 4:17
2:10 s Isa. 57:19 t See ch. 1:16
2:11 u See Acts 10:34
2:12 v 1 Cor. 9:21
2:13 w See James 1:22, 23
2:14 x See ch. 1:19
2:15 y Jer. 31:33
2:16 z [ch. 3:6; 14:10; 1 Cor. 4:5]; See Acts 10:42; 17:31 a ch. 16:25; 2 Tim. 2:8; [Gal. 1:11; 1 Tim. 1:11] b Eccles. 12:14 c ch. 16:25; [1 Tim. 1:11; 2 Tim. 2:8]
2:17 d ver. 23; Mic. 3:11; [ch. 9:4; John 5:45]
2:19 e [Job 29:15; Matt. 15:14; 23:16; John 9:39-41]
2:20 f 2 Tim. 3:5; [Gal. 4:19; 2 Tim. 1:13] g Luke 11:52
2:21 h Matt. 23:3-28; [Ps. 50:16-21; Matt. 15:1-9]
2:22 i Acts 19:37; [Mal. 3:8]
2:23 j See ver. 17; ch. 3:27 k [Mal. 1:6]
2:24 l Cited from Isa. 52:5 m [2 Sam. 12:14; Ezek. 36:20, 23; 2 Pet. 2:2]
2:25 n Gal. 5:3
2:26 o Eph. 2:11; [ch. 3:30] p ch. 1:32; 8:4
2:27 q See Matt. 12:41 r ver. 29; ch. 7:6; 2 Cor. 3:6
2:28 s ch. 9:6-8; [Gal. 6:15] t [ver. 17]
2:29 u See 1 Pet. 3:4 v [Deut. 10:16; 30:6; Jer. 4:4; Acts 7:51; Phil. 3:3; Col. 2:11] w 2 Cor. 10:18; 1 Thess. 2:4; [Gal. 1:10]
3:2 x Deut. 4:8; Ps. 147:19, 20; See John 4:22 y See Acts 7:38
3:3 z ch. 10:16; Heb. 4:2 a [ch. 9:6; 2 Tim. 2:13]
3:4 b See John 8:26 c Ps. 62:9; 116:11; [ver. 7] d Cited from Ps. 51:4 e [Job 9:32]
3:5 f [ch. 2:5] g ch. 6:19; 1 Cor. 9:8; Gal. 3:15; [1 Cor. 15:32]
3:6 h [Gen. 18:25; Job 8:3]; See ch. 2:16
3:7 i [ch. 9:19]
3:8 j [ch. 6:1, 15]
3:9 k ch. 2:1-29 l ch. 1:18-32 m Gal. 3:22; [ver. 19, 23; ch. 11:32; Prov. 20:9]
3:10 n ver. 10-12, cited from Ps. 14:1-3; 53:1-3
3:13 o Cited from Ps. 5:9 p Jer. 5:16 q Cited from Ps. 140:3
3:14 r Cited from Ps. 10:7
3:15 s Cited from Prov. 1:16; ver. 15-17, cited from Isa. 59:7, 8
3:17 t Luke 1:79
3:18 u Cited from Ps. 36:1
3:19 v John 10:34; 15:25 w Job 5:16; Ps. 63:11; 107:42; Ezek. 16:63; [ch. 1:20; 2:1] x See ver. 9
3:20 y Gal. 2:16; [Ps. 143:2; Acts 13:39] z ch. 7:7; [ch. 4:15; 5:13, 20]
3:21 a See ch. 1:17 b ch. 16:26; 2 Tim. 1:10 c Acts 10:43; [ch. 1:2; John 5:46]
3:22 d ch. 4:5; [2 Tim. 3:15] e ch. 10:12; [Gal. 3:28; Col. 3:11]
3:23 f See ver. 9
3:24 g Titus 3:7 h ch. 4:4, 5, 16; See Acts 15:11 i Eph. 1:7; Col. 1:14; Heb. 9:15; [1 Cor. 1:30]
3:25 j Eph. 1:9 k See 1 John 2:2 l ch. 5:9; Eph. 2:13 m ch. 2:4 n [Acts 17:30]
3:27 o ch. 2:17, 23; 4:2; 1 Cor. 1:29-31; Eph. 2:9; 2 Tim. 1:9; See Acts 13:39
3:28 p See James 2:18
3:29 q ch. 9:24; 10:12; 15:9
3:30 r Gal. 3:20; [ch. 10:12] s Gal. 3:8; [ch. 4:9]; See ch. 2:26
4:1 t ver. 16
4:2 u [1 Cor. 1:31]
4:3 v ver. 9, 22; Gal. 3:6; James 2:23; Cited from Gen. 15:6; [Titus 3:8]
4:4 w [ch. 11:6; Deut. 9:4, 5]
4:5 x ch. 3:22; See John 6:29
4:7 y Cited from Ps. 32:1, 2
4:8 z 2 Cor. 5:19
4:9 a ch. 3:30 b ver. 3
4:11 c Gen. 17:10, 11 d ver. 12, 16; [ch. 3:22]; See Luke 19:9
4:13 e Gal. 3:16; Heb. 6:15, 17; 7:6; 11:9, 17; [ch. 9:8]; See Acts 13:32 f Gen. 17:4-6
4:14 g Gal. 3:17, 18
4:15 h ch. 7:7, 10-25; 2 Cor. 3:7, 9; Gal. 3:10 i [ch. 3:20] j Gal. 3:19
4:16 k See ch. 3:24 l Gal. 3:22; [ch. 15:8] m [ch. 9:8]
4:17 n Cited from Gen. 17:5; [ver. 18] o [Heb. 11:19]; See John 5:21 p 1 Cor. 1:28; [Heb. 11:3]
4:18 q Cited from Gen. 15:5
4:19 r Heb. 11:12 s Gen. 17:17 t Gen. 18:11
4:21 u Gen. 18:14; [Heb. 11:19]
4:23 v ch. 15:4; 1 Cor. 9:9, 10; 10:6, 11; 2 Tim. 3:16, 17; [Ps. 102:18]
4:24 w ch. 10:9; 1 Pet. 1:21 x See Acts 2:24
4:25 y ch. 5:6, 8; 8:32; Isa. 53:5, 6; Matt. 20:28; Gal. 1:4 z ch. 5:18; [1 Cor. 15:17]
5:1 a ch. 3:28 b [ch. 15:13; Heb. 12:28]
5:2 c Eph. 2:18; 3:12; [Heb. 10:19, 20; 1 Pet. 3:18] d 1 Cor. 15:1 e ver. 11; Heb. 3:6; [ch. 12:12]
5:3 f See Matt. 5:12 g See Luke 21:19; James 1:3
5:5 h Ps. 119:116; Phil. 1:20 i Acts 2:17, 18, 33; Titus 3:6; [Gal. 4:6]
5:6 j ver. 8, 10; [Hos. 13:9; Eph. 2:5] k See ch. 4:25
5:8 l See John 3:16 m ver. 6, 10
5:9 n See ch. 3:25 o 1 Thess. 1:10; 2:16; See ch. 1:18
5:10 p ver. 6, 8; Col. 1:21; [ch. 8:32] q 2 Cor. 5:18-20; Eph. 2:16; Col. 1:20, 21 r 2 Cor. 4:10, 11
5:11 s ch. 11:15; 2 Cor. 5:18, 19
5:12 t Gen. 2:17; 3:6; 1 Cor. 15:21, 22; [ver. 15-17; ch. 6:9; Ps. 51:5] u ch. 6:23; James 1:15 v [ver. 14, 21; 1 Cor. 15:22] w Eph. 2:3
5:13 x See ch. 3:20
5:14 y Hos. 6:7 z 1 Cor. 15:45 a [Matt. 11:3]
5:15 b ver. 19; Isa. 53:11
5:16 c 1 Cor. 11:32 d ver. 18
5:17 e Rev. 22:5
5:18 f See John 12:32
5:19 g [2 Cor. 10:6] h Heb. 5:8; [Phil. 2:8]
5:20 i Gal. 3:19; See ch. 3:20 j 1 Tim. 1:14
5:21 k [ver. 12, 14] l See John 1:17
6:1 m ver. 15; [ch. 3:8]
6:2 n ver. 11; ch. 7:4, 6; Gal. 2:19; Col. 2:20; 3:3; 1 Pet. 2:24
6:3 o Gal. 3:27 p See Matt. 28:19
6:4 q Col. 2:12 r ver. 9; ch. 8:11; See Acts 2:24 s [John 11:40; 2 Cor. 13:4] t 2 Cor. 5:17; Gal. 6:15; Eph. 4:23, 24; Col. 3:10; [ch. 7:6]
6:5 u [2 Cor. 4:10] v Phil. 3:10, 11; [Col. 2:12; 3:1]
6:6 w Eph. 4:22; Col. 3:9 x Gal. 2:20; 5:24; 6:14 y [ch. 7:24]
6:7 z 1 Pet. 4:1 a [ver. 18]
6:8 b 2 Tim. 2:11; [2 Cor. 4:10; 13:4]
6:9 c Acts 13:34; Rev. 1:18 d [ch. 5:14, 17]
6:10 e See Heb. 7:27
6:11 f See ver. 2
6:12 g ver. 14; Ps. 19:13; 119:133; Mic. 7:19; [2 Cor. 5:17]
6:13 h ch. 7:5; Col. 3:5 i ch. 12:1; 1 Pet. 2:24; 4:2
6:14 j [ch. 8:2, 12] k See ver. 12
6:15 l ver. 1 m [1 Cor. 9:21]
6:16 n [ver. 20; Matt. 6:24]; See John 8:34
6:17 o See ch. 1:8 p [2 Tim. 1:13]
6:18 q ver. 22; ch. 8:2; [ver. 7]; See John 8:32 r [ver. 22]
6:19 s See ch. 3:5 t See ver. 13 u [1 Cor. 9:27]
6:20 v See ver. 16
6:21 w ch. 7:5; [Jer. 12:13] x [2 Cor. 4:2] y ch. 1:32; 8:6, 13; Prov. 14:12; Gal. 6:8
6:22 z See ver. 18 a 1 Cor. 7:22; 1 Pet. 2:16 b ch. 7:4 c 1 Pet. 1:9
6:23 d [ch. 2:7]; See ch. 5:12
7:2 e 1 Cor. 7:39
7:3 f Matt. 5:32
7:4 g ver. 6; See ch. 6:2 h ch. 8:2; Gal. 2:19; 5:18; Eph. 2:15; Col. 2:14 i [Eph. 2:16; Col. 1:22] j ch. 6:22; Gal. 5:22; Eph. 5:9
7:5 k ch. 6:13 l See ch. 6:21, 23
7:6 m See ch. 6:4 n ch. 2:27, 29; 2 Cor. 3:6
7:7 o See ch. 3:20 p ch. 13:9; Ex. 20:17; Deut. 5:21
7:8 q ver. 11; [Gal. 5:13] r 1 Cor. 15:56
7:10 s See ch. 10:5
7:11 t ver. 8 u [Gen. 3:13; Heb. 3:13]
7:12 v Ps. 19:8, 9; 119:137; 2 Pet. 2:21; [ver. 16]
7:14 w 1 Kgs. 21:20, 25; 2 Kgs. 17:17; Isa. 50:1; 52:3
7:15 x ver. 18, 19; [Gal. 5:17]
7:16 y 1 Tim. 1:8; [ver. 12]
7:17 z ver. 20
7:18 a Gen. 6:5; 8:21; Job 14:4; 15:14; Ps. 51:5
7:19 b ver. 15
7:20 c ver. 17
7:22 d Ps. 1:2; 112:1; 119:35 e 2 Cor. 4:16; Eph. 3:16; [1 Pet. 3:4]
7:23 f Gal. 5:17; [James 4:1]
7:24 g [ch. 6:6; 8:23]
8:2 h 1 Cor. 15:45; 2 Cor. 3:6 i ver. 12; See ch. 6:14, 18; 7:4
8:3 j Heb. 10:1, 2, 10, 14; See Acts 13:39 k Gal. 4:9; Heb. 7:18 l Heb. 10:6, 8 m 2 Cor. 5:21 n Phil. 2:7; See John 1:14 o Lev. 16:5; Heb. 10:6, 8; 13:11
8:4 p ch. 1:32; 2:26 q Gal. 5:16, 25
8:5 r [Gal. 6:8] s Gal. 5:19-21 t Gal. 5:22, 23, 25
8:6 u ver. 13; [Col. 2:18]; See ch. 6:21
8:7 v James 4:4 w 1 Cor. 2:14
8:9 x ver. 11; 1 Cor. 3:16; 6:19; 2 Cor. 6:16; 2 Tim. 1:14 y Jude 19; [John 14:17] z See Acts 16:7
8:11 a See Acts 2:24 b [2 Cor. 3:6]
8:12 c See ver. 2
8:13 d Col. 3:5
8:14 e Gal. 5:18 f ver. 16, 19; ch. 9:8, 26; Deut. 14:1; Hos. 1:10; John 1:12
8:15 g 1 Cor. 2:12 h 2 Tim. 1:7; [Gal. 2:4; Heb. 2:15; 1 John 4:18] i ver. 23; Gal. 4:5; [ch. 9:4; Isa. 56:5; Jer. 31:9] j Gal. 4:6; [Mark 14:36]
8:16 k 2 Cor. 1:22; 5:5; Eph. 1:13, 14; 1 John 3:24
8:17 l Gal. 3:29; 4:7; Titus 3:7 m 2 Cor. 1:7; 2 Tim. 2:12; See Acts 14:22
8:18 n 2 Cor. 4:17; [1 Pet. 1:5, 6]
8:19 o 1 Pet. 4:13; 5:1; 1 John 3:2; [ch. 2:7]
8:20 p Gen. 3:18, 19; Eccles. 1:2 q Gen. 3:17
8:21 r [Acts 3:21]
8:22 s Mark 16:15 t Jer. 12:4, 11
8:23 u [2 Cor. 5:5; James 1:18] v 2 Cor. 5:2, 4 w ver. 19, 25; Isa. 25:9; Gal. 5:5 x See ch. 7:24; Luke 21:28
8:24 y [1 Thess. 1:3; 5:8] z 2 Cor. 4:18; Heb. 11:1
8:25 a [1 Thess. 1:3; 5:8]
8:26 b [Matt. 20:22; James 4:3] c Zech. 12:10; Eph. 6:18; See John 14:16
8:27 d 1 Sam. 16:7; 1 Chr. 28:9; Prov. 15:11; 17:3; Jer. 11:20; 17:10; Luke 16:15; 1 Thess. 2:4 e See ver. 6 f [ver. 34] g [1 John 5:14]
8:28 h Ezra 8:22; [Eccles. 8:12] i ch. 9:24; 1 Cor. 1:9; 7:15, 17; Gal. 1:15; 5:8; Eph. 4:1, 4; 2 Tim. 1:9
8:29 j ch. 11:2; 1 Pet. 1:2 k 1 Cor. 2:7; Eph. 1:5, 11; [ch. 9:23] l Phil. 3:21; [1 Cor. 15:49; Col. 3:10]; See 1 John 3:2 m Col. 1:15, 18; Heb. 1:6; Rev. 1:5
8:30 n 1 Cor. 6:11 o John 17:22; [Heb. 2:10]
8:31 p Num. 14:9; 2 Kgs. 6:16; Ps. 118:6; 1 John 4:4
8:32 q John 3:16 r See ch. 4:25
8:33 s Isa. 50:8, 9; [Rev. 12:10, 11]
8:34 t ver. 1 u See Mark 16:19 v Heb. 7:25; 1 John 2:1; [ver. 27]
8:36 w Cited from Ps. 44:22 x 1 Cor. 4:9; 15:30, 31; 2 Cor. 4:10, 11; See Acts 20:24
8:37 y 1 Cor. 15:57; See John 16:33 z Gal. 2:20; Eph. 5:2; Rev. 1:5; 3:9
9:1 a 2 Cor. 11:10; 1 Tim. 2:7; [2 Cor. 12:19; Gal. 1:20]; See ch. 1:9
9:3 b [Ex. 32:32] c 1 Cor. 12:3; 16:22; Gal. 1:8, 9 d [ch. 11:14]
9:4 e [ver. 6; ch. 2:28, 29; Gal. 6:16] f [Ex. 4:22]; See ch. 8:15 g Ex. 40:34; 1 Sam. 4:21; 1 Kgs. 8:11 h Gen. 17:2; Deut. 29:14; Gal. 4:24; Eph. 2:12 i Deut. 4:14; [Ps. 147:19] j Heb. 9:1; [ch. 12:1] k [Eph. 2:12]; See John 4:22; Acts 13:32
9:5 l ch. 11:28 m [Eph. 4:6; Col. 1:16-19] n ch. 1:25; John 1:1; 2 Cor. 11:31; Heb. 1:8
9:7 o [Gal. 4:23]; See John 8:33 p Heb. 11:18; Cited from Gen. 21:12; [Gal. 3:29]
9:8 q Gal. 4:23, 28
9:9 r Cited from Gen. 18:10, 14; [Gen. 17:21]
9:10 s Gen. 25:21
9:11 t [ch. 4:17]; See ch. 8:28
9:12 u Cited from Gen. 25:23
9:13 v Cited from Mal. 1:2, 3
9:14 w Deut. 32:4; 2 Chr. 19:7; Job 8:3; 34:10; Ps. 92:15
9:15 x Cited from Ex. 33:19
9:17 y Cited from Ex. 9:16
9:19 z 2 Chr. 20:6; Job 9:12; Dan. 4:35
9:20 a Job 33:13 b Isa. 29:16; 45:9
9:21 c Isa. 64:8; Jer. 18:6 d 2 Tim. 2:20
9:22 e [ver. 21, 23; Acts 9:15] f [Prov. 16:4; 1 Pet. 2:8]
9:23 g Eph. 3:16; See ch. 2:4 h [ch. 8:29]
9:24 i See ch. 8:28 j See ch. 3:29
9:25 k Cited from Hos. 2:23; [1 Pet. 2:10]
9:26 l Cited from Hos. 1:10 m See ch. 8:14; Matt. 16:16
9:27 n Cited from Isa. 10:22, 23; [Hos. 1:10] o ch. 11:5
9:29 p Cited from Isa. 1:9 q James 5:4 r Deut. 29:23; Isa. 13:19; Jer. 49:18; 50:40; Amos 4:11
9:30 s [ch. 10:20] t ch. 1:17; 3:21, 22; 10:6; Gal. 2:16; 3:24; Phil. 3:9; Heb. 11:7
9:31 u [ch. 10:2, 3; 11:7] v [Gal. 5:4]
9:32 w See 1 Pet. 2:8
9:33 x 1 Pet. 2:6, 7; Cited from Isa. 28:16; [Ps. 118:22] y Isa. 8:14 z ch. 10:11 a Isa. 49:23; Joel 2:26, 27
10:2 b See Acts 21:20 c [ch. 9:31]
10:3 d See ch. 1:17
10:4 e [Matt. 5:17; Gal. 3:24]
10:5 f Cited from Lev. 18:5 g Neh. 9:29; Ezek. 20:11, 13, 21; Matt. 19:17; Luke 10:28; Gal. 3:12; [ch. 7:10]
10:6 h See ch. 9:30 i [Deut. 30:12, 13]
10:7 j See Rev. 9:1 k Heb. 13:20
10:8 l Cited from Deut. 30:14
10:9 m Matt. 10:32; Luke 12:8; [1 Cor. 12:3; Phil. 2:11] n See Acts 16:31 o [1 Pet. 1:21]; See Acts 2:24
10:11 p See ch. 9:33
10:12 q See ch. 3:22, 29 r Acts 10:36 s See ch. 2:4
10:13 t Acts 2:21; Cited from Joel 2:32
10:14 u Eph. 4:21; [John 9:36; 17:20] v [Acts 8:31; Titus 1:3]
10:15 w Cited from Isa. 52:7; [Nah. 1:15; Eph. 6:15]
10:16 x ch. 3:3; Heb. 4:2 y John 12:38; Cited from Isa. 53:1
10:17 z Gal. 3:2, 5
10:18 a Cited from Ps. 19:4; [1 Thess. 1:8] b [Mark 16:15]; See Matt. 24:14
10:19 c Cited from Deut. 32:21 d ch. 11:11, 14 e [Titus 3:3]
10:20 f Cited from Isa. 65:1; [ch. 9:30]
10:21 g Cited from Isa. 65:2
11:1 h 1 Sam. 12:22; Jer. 31:37; 33:24 i 2 Cor. 11:22; Phil. 3:5
11:2 j Ps. 94:14 k ch. 8:29
11:3 l Cited from 1 Kgs. 19:10, 14
11:4 m Cited from 1 Kgs. 19:18
11:5 n ch. 9:27; [Jer. 3:14; Zech. 13:8]
11:6 o [ch. 4:4; Deut. 9:4, 5]
11:7 p See ch. 9:31 q [ver. 25]
11:8 r Isa. 29:10 s Deut. 29:4; [Isa. 43:8; Jer. 5:21; Ezek. 12:2; Eph. 4:18]; See Matt. 13:14
11:9 t Cited from Ps. 69:22, 23
11:11 u [Acts 28:28]
11:13 v ch. 15:16; [Acts 26:17]; See Acts 9:15
11:14 w 1 Cor. 7:16; 9:22; 1 Tim. 4:16; James 5:20
11:15 x ch. 5:11
11:16 y Num. 15:18-21; Neh. 10:37; Ezek. 44:30
11:17 z Jer. 11:16; [Ps. 52:8; John 15:2] a [Eph. 2:12]
11:20 b 1 Cor. 10:12; 2 Cor. 1:24 c ch. 12:3, 16; 1 Tim. 6:17 d Prov. 28:14; Isa. 66:2, 5; Jer. 44:10; Phil. 2:12
11:22 e 1 Cor. 15:2; Heb. 3:6, 14 f [John 15:2]
11:23 g 2 Cor. 3:16
11:25 h ch. 12:16 i 2 Cor. 3:14; [ver. 7] j [Rev. 7:9]; See Luke 21:24
11:26 k Cited from Isa. 59:20, 21; [John 4:22; Heb. 8:8-12] l Ps. 14:7; 53:6
11:27 m See ch. 9:4 n Isa. 27:9; [Heb. 8:12]
11:28 o ch. 9:5; Deut. 7:8; 10:15
11:29 p See ch. 8:28
11:30 q Eph. 2:2, 3, 11, 13; Col. 1:21; 3:7; Titus 3:3
11:32 r See ch. 3:9
11:33 s Col. 2:3; [Ps. 139:6; Eph. 3:10] t Deut. 29:29
11:34 u Isa. 40:13; 1 Cor. 2:16; [Job 15:8] v Job 36:22, 23
11:35 w Job 35:7; 41:11
11:36 x 1 Cor. 8:6; 11:12; Col. 1:16; [Heb. 2:10] y ch. 16:27; Eph. 3:21; Phil. 4:20; 1 Tim. 1:17; 1 Pet. 4:11; 2 Pet. 3:18; Jude 25; Rev. 1:6; 5:13
12:1 z 1 Cor. 1:10; 2 Cor. 10:1; Eph. 4:1 a ch. 6:13, 16, 19; [Ps. 50:13, 14; 1 Cor. 6:20]; See 1 Pet. 2:5 b Heb. 10:20
12:2 c 1 Pet. 1:14; [1 John 2:15] d Titus 3:5; [Ps. 51:10; 2 Cor. 4:16; Eph. 4:23; Col. 3:10] e Eph. 5:10; 1 Thess. 4:3
12:3 f See ch. 1:5 g ver. 16; ch. 11:20 h 1 Cor. 7:17 i Eph. 4:7
12:4 j 1 Cor. 12:12-14; Eph. 4:4, 16
12:5 k 1 Cor. 10:17, 33 l 1 Cor. 12:20; Eph. 4:13; See John 17:11 m Eph. 4:25; [1 Cor. 6:15; 12:27]
12:6 n 1 Cor. 12:4; 1 Pet. 4:10, 11; [1 Cor. 7:7; 12:7-11] o 1 Cor. 12:10; See Acts 13:1 p [2 Tim. 2:15]
12:7 q See Acts 6:1
12:8 r 1 Tim. 5:17; [1 Cor. 12:28] s 2 Cor. 9:7
12:9 t 2 Cor. 6:6; 1 Tim. 1:5; 1 Pet. 1:22 u Ps. 97:10; 101:3; Amos 5:15; [1 Thess. 5:21, 22]
12:10 v See Heb. 13:1 w ch. 13:7; Phil. 2:3; 1 Pet. 2:17
12:11 x Acts 18:25 y Acts 20:19
12:12 z See ch. 5:2 a See Heb. 10:36 b See Acts 1:14
12:13 c ch. 15:25; 1 Cor. 16:1, 15; 2 Cor. 9:1, 12; Heb. 6:10; 13:16; [1 Tim. 6:18] d See Matt. 25:35
12:14 e See Matt. 5:44; 1 Pet. 3:9
12:15 f 1 Cor. 12:26; [Job 30:25; Heb. 13:3]
12:16 g ch. 15:5; 2 Cor. 13:11; Phil. 2:2; 4:2; 1 Pet. 3:8 h ver. 3; Ps. 131:1; Jer. 45:5 i ch. 11:25; Prov. 3:7
12:17 j Prov. 20:22; Matt. 5:39; [ch. 14:19] k 2 Cor. 8:21; [ch. 14:16]
12:18 l See Mark 9:50
12:19 m Prov. 20:22; Matt. 5:39; [ch. 14:19] n Heb. 10:30; Cited from Deut. 32:35; [Ps. 94:1; 1 Thess. 4:6]
12:20 o Cited from Prov. 25:21, 22; [Ex. 23:4, 5; 2 Kgs. 6:22; Luke 6:27]
13:1 p Titus 3:1; 1 Pet. 2:13 q [John 19:11]; See Dan. 2:21
13:3 r 1 Pet. 2:14
13:4 s 2 Chr. 19:6 t 1 Thess. 4:6
13:5 u 1 Pet. 2:19; [Eccles. 8:2]
13:7 v Matt. 17:25; 22:21; Mark 12:17
13:8 w [Lev. 19:13; Prov. 3:27, 28] x ver. 10; [Matt. 22:40; Col. 3:14]; See John 13:34
13:9 y Matt. 19:18; Cited from Ex. 20:13-17; Deut. 5:17-21 z Cited from Lev. 19:18
13:10 a [John 14:15]; See ver. 8
13:11 b 1 Cor. 15:34; Eph. 5:14; 1 Thess. 5:6 c [Isa. 56:1; Luke 21:28]
13:12 d [John 9:4] e Col. 3:8 f Eph. 5:11; [John 3:20] g 2 Cor. 6:7; Eph. 6:11, 13; 1 Thess. 5:8
13:13 h 1 Thess. 4:12 i Luke 21:34; Gal. 5:21; 1 Pet. 4:3 j James 3:14, 16
13:14 k Gal. 3:27; [Job 29:14; Ps. 132:9; Luke 24:49; Eph. 4:24; Col. 3:10] l Gal. 5:16; 1 Pet. 2:11
14:1 m ch. 15:1; 1 Cor. 8:9-11; 9:22
14:2 n ver. 14
14:3 o Col. 2:16
14:4 p James 4:12
14:5 q Gal. 4:10; [Zech. 7:5, 6] r ver. 23
14:6 s 1 Cor. 10:30, 31; 1 Tim. 4:3, 4; See Matt. 15:36
14:7 t 2 Cor. 5:15; Gal. 2:20; 1 Pet. 4:2; [1 Cor. 6:19; 1 Thess. 5:10]
14:8 u Phil. 1:20
14:9 v Rev. 1:18; 2:8 w See Acts 10:42; Rev. 20:12
14:10 w [See ver. 9 above] x 2 Cor. 5:10
14:11 y Phil. 2:10, 11; Cited from Isa. 45:23
14:12 z Matt. 12:36; 16:27; 1 Pet. 4:5; [Gal. 6:5]
14:13 a See Matt. 7:1 b [1 Cor. 8:13]
14:14 c ver. 2, 20; See Acts 10:15 d [1 Cor. 8:7, 10]
14:15 e Eph. 5:2 f 1 Cor. 8:11; [ver. 20]
14:16 g [ch. 12:17; 1 Cor. 10:29, 30]
14:17 h 1 Cor. 8:8 i [1 Cor. 6:9] j Gal. 5:22; [ch. 15:13]
14:18 k [2 Cor. 8:21]
14:19 l Ps. 34:14; 1 Cor. 7:15; 2 Tim. 2:22 m ch. 15:2; 1 Cor. 14:12
14:20 n ver. 15 o Titus 1:15; See ver. 14 p 1 Cor. 8:9-12
14:21 q 1 Cor. 8:13
14:22 r 1 John 3:21
15:1 s [Gal. 6:1] t 1 Thess. 5:14; See ch. 14:1
15:2 u 1 Cor. 10:33; [1 Cor. 9:19, 22; 10:24; Phil. 2:4]
15:3 v Phil. 2:5, 8; [John 5:30; 6:38] w Cited from Ps. 69:9
15:4 x ch. 4:23 y 2 Tim. 3:16 z Ps. 119:50
15:5 a See ch. 12:16
15:6 b 2 Cor. 1:3; Eph. 1:3; 1 Pet. 1:3; [John 20:17; Eph. 1:17; Rev. 1:6]
15:8 c Matt. 15:24; John 1:11; [Heb. 3:1]; See Acts 3:26 d [ch. 4:16; 2 Cor. 1:20]
15:9 e See ch. 3:29 f Cited from 2 Sam. 22:50; Ps. 18:49
15:10 g Cited from Deut. 32:43
15:11 h Cited from Ps. 117:1
15:12 i Cited from Isa. 11:10 j Isa. 11:1; [Rev. 5:5; 22:16] k Matt. 12:21
15:13 l [ch. 5:1, 2; 14:17]
15:14 m [2 Pet. 1:12; 3:1; 1 John 2:21] n 1 Cor. 1:5; 13:2; [1 Cor. 8:1, 7, 10; 12:8]
15:15 o See ch. 1:5
15:16 p See ch. 11:13 q [Mal. 1:11] r Isa. 66:20; [Phil. 2:17]
15:17 s Phil. 3:3 t Heb. 2:17; 5:1
15:18 u Acts 15:12; 21:19; Gal. 2:8 v See ch. 1:5
15:19 w 2 Cor. 12:12; [Acts 19:11] x Acts 22:17-21 y [Acts 20:1, 2]
15:20 z [2 Cor. 10:13, 15, 16]
15:21 a Cited from Isa. 52:15
15:22 b ch. 1:13; [1 Thess. 2:18]
15:23 c ver. 29, 32; ch. 1:10, 11; Acts 19:21
15:24 d ver. 28 e See Acts 15:3
15:25 f Acts 19:21; 20:22; 21:15; 24:17; [ver. 31]
15:26 g 1 Cor. 16:1-4; 2 Cor. 8:1; 9:2, 13
15:27 h 1 Cor. 9:11; [Gal. 6:6]
15:28 i ver. 24
15:30 j [Phil. 2:1; Col. 1:8] k Col. 4:12; [2 Cor. 1:11; Col. 2:1, 2; Heb. 13:18]
15:31 l 2 Thess. 3:2; [2 Tim. 3:11; 4:17] m 2 Cor. 8:4
15:32 n [1 Cor. 16:18; 2 Cor. 7:13; Philem. 7, 20]
15:33 o ch. 16:20; 2 Cor. 13:11; Phil. 4:9; 1 Thess. 5:23; Heb. 13:20; [1 Cor. 14:33; 2 Thess. 3:16]
16:1 p Acts 18:18
16:2 q Phil. 2:29
16:3 r See Acts 18:2
16:5 s 1 Cor. 16:19; [Col. 4:15; Philem. 2] t [1 Cor. 16:15]
16:7 u Col. 4:10; Philem. 23
16:10 v 1 Cor. 1:11
16:16 w 1 Cor. 16:20; 2 Cor. 13:12; 1 Thess. 5:26; [1 Pet. 5:14]
16:17 x 1 Tim. 1:3; 6:3 y See 2 John 10
16:18 z Phil. 3:19; [2 Tim. 3:4; Titus 1:12] a Col. 2:4; 2 Pet. 2:3
16:19 b ch. 1:8 c [Jer. 4:22]; See Matt. 10:16
16:20 d See ch. 15:33 e Gen. 3:15; [Luke 10:17-19; Rev. 12:11] f 1 Cor. 16:23
16:21 g See Acts 16:1
16:22 h See 1 Cor. 16:21
16:23 i 1 Cor. 1:14; [Acts 19:29; 20:4; 3 John 1]
16:25 j Eph. 3:20; Jude 24 k See ch. 2:16 l 1 Cor. 2:1; 4:1; Eph. 1:9; 3:3-5; 5:32; 6:19 m [1 Cor. 2:7] n 2 Tim. 1:9; Titus 1:2
16:26 o Col. 1:26; 2 Tim. 1:10; Titus 1:3 p [Col. 1:6]; See ch. 1:5
16:27 q 1 Tim. 1:17; 6:16 r See ch. 11:36`

function processEntry(key, rest) {
  const chapter = parseInt(key.split(':')[0], 10)
  let s = rest

  // Remove square brackets but keep content
  s = s.replace(/\[([^\]]*)\]/g, '$1')

  // Remove "(Gk.)" and similar parentheticals
  s = s.replace(/\s*\([A-Za-z.]+\)\s*/g, ' ')

  // Remove "See " and "Cited from " prefixes (case-insensitive)
  s = s.replace(/\bSee\s+/gi, '')
  s = s.replace(/\bCited from\s+/gi, '')

  // Expand "ver. X, Y, Z" → "Romans {chapter}:X; Romans {chapter}:Y"
  // Use ([\d\-]+(?:\s*,\s*[\d\-]+)*) to avoid consuming trailing whitespace
  s = s.replace(/\bver\.\s*([\d\-]+(?:\s*,\s*[\d\-]+)*)/g, (_, nums) => {
    return nums.split(',').map(n => {
      const base = n.trim().split('-')[0].trim()
      return base ? `Romans ${chapter}:${base}` : ''
    }).filter(Boolean).join('; ')
  })

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Strip leading footnote marker (single lowercase letter before a ref)
  s = s.replace(/^[a-z]\s+/, '')

  // Replace internal footnote markers: " x Ref" → "; Ref"
  // Footnote markers are always single isolated lowercase letters between spaces.
  // Using no lookahead so "ch." and "ver." (starting with lowercase) are also caught.
  s = s.replace(/\s+[a-z]\s+/g, '; ')
  s = s.replace(/;\s*[a-z]\s+/g, '; ')

  // Split by semicolons
  const parts = s.split(';').map(p => p.trim()).filter(Boolean)

  const expanded = []
  let romansContext = false

  for (let part of parts) {
    part = part.trim()
    if (!part) continue

    // "ch. X:Y" or "ch. X" → Romans reference
    const chMatch = part.match(/^ch\.\s*(.+)/)
    if (chMatch) {
      let refPart = chMatch[1].trim()
      // Handle comma-listed verses: "ch. 6:6, 8:23" — these are CHAPTER refs, split by comma
      // Actually "ch. 6:6; 8:23" is already split; "ch. 6:6, 8" means Romans 6:6 and 6:8
      expanded.push(`Romans ${refPart}`)
      romansContext = true
      continue
    }

    // Bare "X:Y" or "X:Y, Z" after a Romans context
    const bareMatch = part.match(/^(\d+:\d+(?:,\s*\d+)*)$/)
    if (bareMatch && romansContext) {
      expanded.push(`Romans ${bareMatch[1]}`)
      continue
    }

    // Anything else resets Romans context
    romansContext = false
    expanded.push(part)
  }

  // Filter garbage
  const filtered = expanded
    .map(p => p.trim())
    .filter(p => p.length > 2 && !/^[a-z]$/.test(p) && !/^\d+$/.test(p))

  return filtered.join('; ')
}

// Parse all lines
const entries = {}
for (const line of RAW.trim().split('\n')) {
  const m = line.match(/^(\d+:\d+)\s+(.+)/)
  if (!m) continue
  const [, key, rest] = m
  const result = processEntry(key, rest)
  if (result) entries[key] = result
}

// Output
let out = '// Auto-generated — do not edit manually\n'
out += '// Romans cross-references from ESV Study Bible footnotes\n'
out += 'export const ROMANS_XREFS = {\n'
for (const [k, v] of Object.entries(entries)) {
  out += `  "${k}": ${JSON.stringify(v)},\n`
}
out += '}\n'

process.stdout.write(out)
