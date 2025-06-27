import type { MediaTrack } from "./types";

export const DEMO_TRACKS: MediaTrack[] = [
  {
    id: "bitsong-multi-source-demo",
    metadata: {
      title: "Bitsong Multi-Source Demo",
      artist: "Bitsong",
      artwork: "https://bitsong.io/logo.png",
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