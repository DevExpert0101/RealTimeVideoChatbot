import "./index.css";
import { useEffect, useRef, useState } from "react";
import ChatApp from "./ChatApp";
import FileUpload from "./FileUpload";

const DID_URL = "https://api.d-id.com";
const DID_KEY = "Z29sZGdsb3ZlMzA0QGdtYWlsLmNvbQ:aAZa3j9IT50JHfVc596oG";

function App() {
  let peerConnection;
  let streamId;
  let sessionId;
  let sessionClientAnswer;

  let statsIntervalId;
  let videoIsPlaying;
  let lastBytesReceived;

  const talkVideo = useRef(null);
  const peerStatusLabel = useRef();
  const iceStatusLabel = useRef();
  const iceGatheringStatusLabel = useRef();
  const signalingStatusLabel = useRef();
  const streamingStatusLabel = useRef();
  const inputField = useRef();

  const [question, setQuestion] = useState("");

  const stopAllStreams = () => {
    if (talkVideo.current.srcObject) {
      console.log("stopping video streams...");
      talkVideo.current.srcObject.getTracks().forEach((track) => track.stop());
      talkVideo.current.srcObject = null;
    }
  };

  function onIceGatheringStateChange() {
    iceGatheringStatusLabel.current.innerText =
      peerConnection.iceGatheringState;
    console.log(peerConnection.iceConnectionState);
    iceGatheringStatusLabel.current.className =
      "iceGatheringState-" + peerConnection.iceGatheringState;
  }

  function onIceCandidate(event) {
    console.log("onIceCandidate", event);
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

      fetch(`${DID_URL}/talks/streams/${streamId}/ice`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        }),
      });
    }
  }

  function onIceConnectionStateChange() {
    iceStatusLabel.current.innerText = peerConnection.iceConnectionState;
    iceStatusLabel.current.className =
      "iceConnectionState-" + peerConnection.iceConnectionState;
    if (
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.iceConnectionState === "closed"
    ) {
      stopAllStreams();
      closePC();
    }
  }
  function onConnectionStateChange() {
    // not supported in firefox
    peerStatusLabel.current.innerText = peerConnection.connectionState;
    peerStatusLabel.current.className =
      "peerConnectionState-" + peerConnection.connectionState;
  }
  function onSignalingStateChange() {
    signalingStatusLabel.current.innerText = peerConnection.signalingState;
    signalingStatusLabel.current.className =
      "signalingState-" + peerConnection.signalingState;
  }

  function setVideoElement(stream) {
    if (!stream) return;
    talkVideo.current.srcObject = stream;
    talkVideo.current.loop = false;

    // safari hotfix
    if (talkVideo.current.paused) {
      talkVideo.current
        .play()
        .then((_) => {})
        .catch((e) => {});
    }
  }

  function playIdleVideo() {
    talkVideo.current.srcObject = undefined;
    talkVideo.current.src = "oracle_Idle.mp4";
    talkVideo.current.loop = true;
  }

  function onVideoStatusChange(videoIsPlaying, stream) {
    let status;
    if (videoIsPlaying) {
      status = "streaming";
      const remoteStream = stream;
      setVideoElement(remoteStream);
    } else {
      status = "empty";
      playIdleVideo();
    }
    streamingStatusLabel.current.innerText = status;
    streamingStatusLabel.current.className = "streamingState-" + status;
  }

  function onTrack(event) {
    /**
     * The following code is designed to provide information about wether currently there is data
     * that's being streamed - It does so by periodically looking for changes in total stream data size
     *
     * This information in our case is used in order to show idle video while no talk is streaming.
     * To create this idle video use the POST https://api.d-id.com/talks endpoint with a silent audio file or a text script with only ssml breaks
     * https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html#break-tag
     * for seamless results use `config.fluent: true` and provide the same configuration as the streaming video
     */

    if (!event.track) return;

    statsIntervalId = setInterval(async () => {
      const stats = await peerConnection.getStats(event.track);
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          const videoStatusChanged =
            videoIsPlaying !== report.bytesReceived > lastBytesReceived;

          if (videoStatusChanged) {
            videoIsPlaying = report.bytesReceived > lastBytesReceived;
            onVideoStatusChange(videoIsPlaying, event.streams[0]);
          }
          lastBytesReceived = report.bytesReceived;
        }
      });
    }, 500);
  }

  const closePC = (pc = peerConnection) => {
    if (!pc) return;
    console.log("stopping peer connection");
    pc.close();
    pc.removeEventListener(
      "icegatheringstatechange",
      onIceGatheringStateChange,
      true
    );
    pc.removeEventListener("icecandidate", onIceCandidate, true);
    pc.removeEventListener(
      "iceconnectionstatechange",
      onIceConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "connectionstatechange",
      onConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "signalingstatechange",
      onSignalingStateChange,
      true
    );
    pc.removeEventListener("track", onTrack, true);
    clearInterval(statsIntervalId);
    iceGatheringStatusLabel.current.innerText = "";
    signalingStatusLabel.current.innerText = "";
    iceStatusLabel.current.innerText = "";
    peerStatusLabel.innerText = "";
    console.log("stopped peer connection");
    if (pc === peerConnection) {
      peerConnection = null;
    }
  };

  async function createPeerConnection(offer, iceServers) {
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({ iceServers });

      peerConnection.addEventListener(
        "icegatheringstatechange",
        onIceGatheringStateChange,
        true
      );

      peerConnection.addEventListener("icecandidate", onIceCandidate, true);

      peerConnection.addEventListener(
        "iceconnectionstatechange",
        onIceConnectionStateChange,
        true
      );

      peerConnection.addEventListener(
        "connectionstatechange",
        onConnectionStateChange,
        true
      );

      peerConnection.addEventListener(
        "signalingstatechange",
        onSignalingStateChange,
        true
      );

      peerConnection.addEventListener("track", onTrack, true);
    }
    console.log("offer is ", offer);
    await peerConnection.setRemoteDescription(offer);
    console.log("set remote sdp OK");

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log("create local sdp OK");

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log("set local sdp OK");

    return sessionClientAnswer;
  }

  async function Connect_DID() {
    if (peerConnection && peerConnection.connectionState === "connected") {
      return;
    }

    stopAllStreams();
    closePC();

    const sessionResponse = await fetch(`${DID_URL}/talks/streams`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${DID_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url:
          "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg",
      }),
    });

    const {
      id: newStreamId,
      offer,
      ice_servers: iceServers,
      session_id: newSessionId,
    } = await sessionResponse.json();
    console.log(newStreamId);
    streamId = newStreamId;
    sessionId = newSessionId;

    try {
      sessionClientAnswer = await createPeerConnection(offer, iceServers);
    } catch (e) {
      console.log("error during streaming setup", e);
      stopAllStreams();
      closePC();
      return;
    }

    const sdpResponse = await fetch(
      `${DID_URL}/talks/streams/${streamId}/sdp`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: sessionId,
        }),
      }
    );
  }

  async function Start_Talk() {
    if (
      peerConnection?.signalingState === "stable" ||
      peerConnection?.iceConnectionState === "connected"
    ) {
      //
      // New from Jim 10/23 -- Get the user input from the text input field get ChatGPT Response
      const userInput = inputField.current.value;
      // const responseFromOpenAI = await fetchOpenAIResponse(userInput);
      const responseFromOpenAI = "Hello. This is ai testing.";
      //
      // Print the openAIResponse to the console
      console.log("OpenAI Response:", responseFromOpenAI);
      //
      const talkResponse = await fetch(`${DID_URL}/talks/streams/${streamId}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: {
            type: "text",
            subtitles: "false",
            provider: {
              type: "microsoft",
              voice_id: "en-US-ChristopherNeural",
            },
            ssml: false,
            input: responseFromOpenAI, //send the openAIResponse to D-id
          },
          config: {
            fluent: true,
            pad_audio: 0,
            driver_expressions: {
              expressions: [
                { expression: "neutral", start_frame: 0, intensity: 0 },
              ],
              transition_frames: 0,
            },
            align_driver: true,
            align_expand_factor: 0,
            auto_match: true,
            motion_factor: 0,
            normalization_factor: 0,
            sharpen: true,
            stitch: true,
            result_format: "mp4",
          },
          driver_url: "bank://lively/",
          config: {
            stitch: true,
          },
          session_id: sessionId,
        }),
      });
    }
  }

  async function Desctroy() {
    await fetch(`${DID_URL}/talks/streams/${streamId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${DID_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    stopAllStreams();
    closePC();
  }

  return (
    <div id="content" style={{ display: "flex", flexDirection: "row", justifyContent: "space-around"}}>
      <div>
        <FileUpload />
      </div>
      <div >
        <div id="video-wrapper">
          <div>
            <video
              id="talk-video"
              width="400"
              height="400"
              autoPlay
              playsInline={true}
              ref={talkVideo}
            ></video>
          </div>
        </div>
        <br />
        <div id="input-container">
          <input
            type="text"
            id="user-input-field"
            placeholder="I am your ChatGPT Live Agent..."
            ref={inputField}
          />
          <hr />
        </div>
        <div id="buttons">
          <button id="connect-button" type="button" onClick={Connect_DID}>
            Connect
          </button>
          <button id="talk-button" type="button" onClick={Start_Talk}>
            Start
          </button>
          <button id="destroy-button" type="button" onClick={Desctroy}>
            Destroy
          </button>
        </div>
        <div id="status">
          ICE gathering status:{" "}
          <label
            id="ice-gathering-status-label"
            ref={iceGatheringStatusLabel}
          ></label>
          <br />
          ICE status: <label id="ice-status-label" ref={iceStatusLabel}></label>
          <br />
          Peer connection status:{" "}
          <label id="peer-status-label" ref={peerStatusLabel}></label>
          <br />
          Signaling status:{" "}
          <label id="signaling-status-label" ref={signalingStatusLabel}></label>
          <br />
          Streaming status:{" "}
          <label id="streaming-status-label" ref={streamingStatusLabel}></label>
          <br />
        </div>
      </div>
      <div style={{ width: "800px" }}>
        <ChatApp />
      </div>
    </div>
  );
}

export default App;
