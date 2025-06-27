export const DEMO_TRACKS = [
  {
    id: "ready-or-not",
    metadata: {
      title: "Ready or Not",
      artist: "Adam Clay",
      artwork: "https://media-api.bitsong.studio/ipfs/QmWF5LpGkH67fqv89cTrB36UAcxo2ZtbY9VSMv7wKKaAoQ",
    },
    sources: [
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/video/hls-video/master.m3u8",
        format: "hls",
        mediaType: "video",
        quality: "Video (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/QmauEHKa5UoRRz8wKNjdhhq4vxGgGr2P3QBMMXyYeH5HqP",
        format: "mp4",
        mediaType: "video",
        quality: "Video (MP4)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/hls/master.m3u8",
        format: "hls",
        mediaType: "audio",
        quality: "Audio (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/opus/8f82d255470cbadfcbd79e2ec2d6d096.opus",
        format: "opus",
        mediaType: "audio",
        quality: "Audio (Opus)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/mp3/8f82d255470cbadfcbd79e2ec2d6d096.mp3",
        format: "mp3",
        mediaType: "audio",
        quality: "Audio (MP3)",
      },
    ],
  },
  {
    id: "cubana",
    metadata: {
      title: "Cubana",
      artist: "BlackJack Records",
      artwork: "https://media-api.bitsong.studio/ipfs/QmdijLzx2c43XnacBRLAB1rPCtkn4ePjKpfGMQZq2pfbZk",
    },
    sources: [
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/hls/master.m3u8",
        format: "hls",
        mediaType: "audio",
        quality: "Audio (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/opus/659fb82d4cbc762f18a43490cbf32a11.opus",
        format: "opus",
        mediaType: "audio",
        quality: "Audio (Opus)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/mp3/659fb82d4cbc762f18a43490cbf32a11.mp3",
        format: "mp3",
        mediaType: "audio",
        quality: "Audio (MP3)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/aac/659fb82d4cbc762f18a43490cbf32a11.m4a",
        format: "aac",
        mediaType: "audio",
        quality: "Audio (AAC)",
      },
    ],
  },
  {
    id: "big-buck-bunny",
    metadata: {
      title: "Big Buck Bunny",
      artist: "Blender Foundation",
      artwork: "https://d2zihajmogu5jn.cloudfront.net/big-buck-bunny/poster.jpg",
    },
    sources: [
      {
        src: "https://d2zihajmogu5jn.cloudfront.net/big-buck-bunny/master.m3u8",
        format: "hls",
        mediaType: "video",
        quality: "HLS Auto",
      },
    ],
  },
]