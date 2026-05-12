import { ref, push, onValue, off, update, remove } from 'firebase/database';
import { database } from '../integrations/firebase/config';

export interface CallData {
  id: string;
  callerId: string;
  calleeId: string;
  type: 'audio' | 'video';
  status: 'calling' | 'connected' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
  createdAt: number;
}

export class CallService {
  private callsRef = ref(database, 'calls');
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private currentCallId: string | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.initializeRingtone();
  }

  private initializeRingtone() {
    const preference = localStorage.getItem('wargram-ringtone') || 'wargram';
    if (preference === 'silent') {
      this.ringtoneAudio = null;
      return;
    }
    this.ringtoneAudio = new Audio(preference === 'classic' ? '/ringtone.mp3' : '/ringtone.wav');
    this.ringtoneAudio.loop = true;
  }

  private playRingtone() {
    this.initializeRingtone();
    if (this.ringtoneAudio) {
      this.ringtoneAudio.play().catch(console.error);
    }
  }

  private stopRingtone() {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }
  }

  // Initialize call
  async startCall(calleeId: string, type: 'audio' | 'video', callerId: string): Promise<string> {
    const callRef = push(this.callsRef);
    const callId = callRef.key!;

    const callData: CallData = {
      id: callId,
      callerId,
      calleeId,
      type,
      status: 'calling',
      iceCandidates: [],
      createdAt: Date.now(),
    };

    await update(callRef, callData);

    // Set up local media
    await this.setupLocalMedia(type);

    // Create offer
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    // Update call with offer
    await update(callRef, {
      offer: offer.toJSON(),
    });

    // Listen for answer and ICE candidates
    this.listenForAnswer(callId);
    this.listenForIceCandidates(callId);

    return callId;
  }

  // Answer call
  async answerCall(callId: string, calleeId: string) {
    const callRef = ref(database, `calls/${callId}`);

    // Get call data
    onValue(callRef, async (snapshot) => {
      const callData: CallData = snapshot.val();
      if (!callData || callData.calleeId !== calleeId) return;

      // Set up local media
      await this.setupLocalMedia(callData.type);

      // Set remote description
      if (callData.offer) {
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(callData.offer));

        // Create answer
        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);

        // Update call with answer
        await update(callRef, {
          answer: answer.toJSON(),
          status: 'connected',
        });

        // Listen for ICE candidates
        this.listenForIceCandidates(callId);
      }
    }, { onlyOnce: true });
  }

  // Set up local media stream
  private async setupLocalMedia(type: 'audio' | 'video') {
    try {
      const constraints = {
        audio: true,
        video: type === 'video',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set up remote stream
      this.remoteStream = new MediaStream();
      this.peerConnection!.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream!.addTrack(track);
        });
      };

      // Handle ICE candidates
      this.peerConnection!.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to Firebase
          this.sendIceCandidate(event.candidate.toJSON());
        }
      };

    } catch (error) {
      console.error('Error setting up media:', error);
      throw error;
    }
  }

  // Send ICE candidate
  private async sendIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.currentCallId) return;
    const candidatesRef = ref(database, `calls/${this.currentCallId}/iceCandidates`);
    await push(candidatesRef, candidate);
  }

  // Listen for incoming calls
  listenForIncomingCalls(userId: string, onCallReceived: (callData: CallData) => void) {
    const userCallsRef = ref(database, `calls`);
    onValue(userCallsRef, (snapshot) => {
      const calls = snapshot.val();
      if (!calls) return;

      Object.keys(calls).forEach(callId => {
        const callData: CallData = calls[callId];
        if (callData.calleeId === userId && callData.status === 'calling' && callId !== this.currentCallId) {
          this.currentCallId = callId;
          this.playRingtone();
          onCallReceived(callData);
        }
      });
    });
  }

  // Accept call
  async acceptCall(callId: string) {
    this.stopRingtone();
    const callRef = ref(database, `calls/${callId}`);
    onValue(callRef, async (snapshot) => {
      const callData: CallData = snapshot.val();
      if (!callData) return;
      await this.answerCall(callId, callData.calleeId);
    }, { onlyOnce: true });
  }

  // Reject call
  rejectCall(callId: string) {
    this.stopRingtone();
    const callRef = ref(database, `calls/${callId}`);
    update(callRef, { status: 'ended' });
  }

  // Listen for ICE candidates
  private listenForIceCandidates(callId: string) {
    const candidatesRef = ref(database, `calls/${callId}/iceCandidates`);
    onValue(candidatesRef, (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const candidate = childSnapshot.val();
        if (candidate && !candidate.processed) {
          this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
          // Mark as processed
          update(childSnapshot.ref, { processed: true });
        }
      });
    });
  }

  // End call
  async endCall(callId: string) {
    const callRef = ref(database, `calls/${callId}`);
    await update(callRef, { status: 'ended' });

    // Clean up
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Remove listeners
    off(callRef);
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export const callService = new CallService();
