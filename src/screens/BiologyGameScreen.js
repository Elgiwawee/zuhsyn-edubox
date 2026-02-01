// AgricGameScreen.js – FIXED INTERACTION + COINS + COLLISION

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import Sound from 'react-native-sound';

import GameQuiz from '../data/biologyGameQuiz';

const { width, height } = Dimensions.get('window');
const LANE_COUNT = 3;
const LANE_WIDTH = width / LANE_COUNT;

const COIN_SIZE = 40;
const IS_EMULATOR = true;

/// ---- COIN RAIN TUNING ----
const COIN_DROP_CHANCE = IS_EMULATOR ? 0.02 : 0.04;
const MAX_COINS_ON_SCREEN = 8;
const MAX_GAME_SPEED = IS_EMULATOR ? 6 : 9;

const RUNNER_Y = height * 0.68;
const BASE_SPEED = IS_EMULATOR ? 2 : 4;

const RUNNER_JSON = require('../../assets/lottie/runner_base.json');
const COIN_JSON = require('../../assets/lottie/coin_spin.json');

/* ---------------- SOUNDS ---------------- */
Sound.setCategory && Sound.setCategory('Playback');
const SFX = {};
['ding', 'buzz', 'gameover'].forEach(k => {
  SFX[k] = new Sound(k, Sound.MAIN_BUNDLE, () => {});
});
const playSfx = k => SFX[k] && SFX[k].stop(() => SFX[k].play());

export default function BiologyGameScreen() {
  const navigation = useNavigation();

  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);

  const [playerLane, setPlayerLane] = useState(1);
  const [gates, setGates] = useState([]);
  const [coinDrops, setCoinDrops] = useState([]);
  const [animState, setAnimState] = useState('idle');
  const jumpAnim = useRef(new Animated.Value(0)).current;


  const speedRef = useRef(BASE_SPEED);
  const tickRef = useRef(null);
  const gateRef = useRef(null);



  /* ---------------- START / STOP ---------------- */
  const startGame = () => {
    console.log('GAME STARTED');
    if (running) return;

    setRunning(true);
    setScore(0);
    setLives(3);
    setAnimState('run');

    setGates([]);
    setCoinDrops([]);

    speedRef.current = BASE_SPEED;

    gateRef.current = setInterval(spawnGate, 5000);
    tickRef.current = setInterval(gameTick, 16);

    
  };

  const stopGame = () => {
    setRunning(false);
    setAnimState('idle');

    clearInterval(gateRef.current);
    clearInterval(tickRef.current);
  };


  /* ---------------- GAME LOOP ---------------- */
  const gameTick = () => {
    // ---- SPEED RAMP ----
    speedRef.current = Math.min(
      speedRef.current + 0.002,
      MAX_GAME_SPEED
    );

    // ---- MOVE GATES ----
    setGates(gs =>
      gs
        .map(g => ({ ...g, y: g.y + speedRef.current }))
        .filter(g => g.y < height + 120)
    );

    // ---- MOVE + SPAWN COINS (SINGLE STATE UPDATE) ----
    setCoinDrops(cs => {
      // move existing coins
      let next = cs
        .map(c => ({ ...c, y: c.y + speedRef.current + 1 }))
        .filter(c => c.y < height + COIN_SIZE);

      // random rain spawn 🌧️
      if (
        Math.random() < COIN_DROP_CHANCE &&
        next.length < MAX_COINS_ON_SCREEN
      ) {
        next.push({
          id: Date.now() + Math.random(),
          lane: Math.floor(Math.random() * LANE_COUNT),
          y: -COIN_SIZE,
        });
      }

      return next;
    });
  };


  /* ---------------- SPAWN GATE ---------------- */
  const spawnGate = () => {
    const q = GameQuiz.getRandomQuestion();
    if (!q) return;

    setGates(gs => [...gs, {
      id: Date.now(),
      y: -140,
      question: q,
    }]);
    console.log('Gate spawned at', Date.now());
  };

  
  /* ---------------- ANSWER HANDLER ---------------- */
  const handleAnswer = (gate, laneIndex) => {
    setPlayerLane(laneIndex);

    const chosen = gate.question.options[laneIndex];
    const correct = chosen === gate.question.answer;

    if (correct) {
      playSfx('ding');
      setScore(s => s + 10);
      setCoins(c => c + 1);

      Animated.sequence([
        Animated.timing(jumpAnim, {
          toValue: -40,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(jumpAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      setCoinDrops(cs => [
        ...cs,
        {
          id: Date.now() + Math.random(),
          lane: laneIndex,
          y: gate.y,
        },
      ]);
    } else {
      playSfx('buzz');
      Vibration.vibrate(200);
      setLives(l => l - 1);
    }

    setGates(gs => gs.filter(g => g.id !== gate.id));
  };

  useEffect(() => {
    if (!running) return;

    setCoinDrops(cs =>
      cs.filter(c => {
        const sameLane = c.lane === playerLane;
        const nearRunner =
          c.y > RUNNER_Y - 20 &&
          c.y < RUNNER_Y + 10;

        if (sameLane && nearRunner) {
          playSfx('ding');
          setCoins(coins => coins + 1);
          return false; // collected
        }
        return true;
      })
    );
  }, [playerLane, running]);

  /* ---------------- GAME OVER ---------------- */
  useEffect(() => {
    if (lives <= 0 && running) {
      playSfx('gameover');
      stopGame();
      Alert.alert('Game Over', `Score: ${score}`);
    }
  }, [lives]);

  /* ---------------- SWIPE SUPPORT ---------------- */
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 30,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) setPlayerLane(l => Math.min(2, l + 1));
        if (g.dx < -40) setPlayerLane(l => Math.max(0, l - 1));
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>

      {/* HUD */}
      <View style={styles.hud}>
        <Text>Score: {score}</Text>
        <Text>Coins: {coins}</Text>
        <Text>Lives: {lives}</Text>
      </View>

      {/* GATES */}
      {gates.map(g => (
        <View key={g.id} style={[styles.gateWrap, { top: g.y }]}>
          <Text style={styles.question}>{g.question.question}</Text>
          <View style={styles.row}>
            {g.question.options.map((o, i) => (
              <TouchableOpacity
                key={i}
                style={styles.gate}
                onPress={() => handleAnswer(g, i)}
              >
                <Text>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* COINS */}
      {coinDrops.map(c => (
        <View
          key={c.id}
          style={{
            position: 'absolute',
            left: c.lane * LANE_WIDTH + LANE_WIDTH / 2 - 25,
            top: c.y,
          }}
        >
          <LottieView source={COIN_JSON} autoPlay loop style={{ width: 50, height: 50 }} />
        </View>
      ))}

      {/* RUNNER */}
      <Animated.View
        style={[
          styles.runner,
          {
            left: playerLane * LANE_WIDTH + LANE_WIDTH / 2 - 50,
            transform: [{ translateY: jumpAnim }],
          },
        ]}
      >
        <LottieView
          source={RUNNER_JSON}
          autoPlay
          loop
          resizeMode="contain"
          style={{ width: 100, height: 100 }}
        />
      </Animated.View>


      {/* CONTROLS */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={running ? stopGame : startGame}>
          <Text style={styles.btnText}>{running ? 'STOP' : 'START'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('GameShop')}>
          <Text style={styles.btnText}>SHOP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>EXIT</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#cceeff' },
  hud: { position: 'absolute', top: 40, left: 10 },

  gateWrap: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },

  question: { fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },

  gate: {
    width: LANE_WIDTH - 20,
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  runner: {
    position: 'absolute',
    bottom: height * 0.18,
    zIndex: 50,
    elevation: 50,
  },


  controls: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },

  btn: {
    backgroundColor: '#001F54',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },

  btnText: { color: '#fff', fontWeight: '700' },
});
