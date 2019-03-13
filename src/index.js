import {
  K,
  apply,
  compose,
  eq,
  equal,
  isFunction,
  map,
  not
} from '@nuware/functions'

import Emitter from '@nuware/emitter'
import ID from '@nuware/id'

const emitter = Emitter()

const raiseError = message => {
  throw new Error(message)
}

const SIGNAL_CREATED = 'SIGNAL_CREATED'
const EFFECT_CREATED = 'EFFECT_CREATED'
const STORE_CREATED = 'STORE_CREATED'

export const onSignalCreated = cb => emitter.on(SIGNAL_CREATED)(cb)
export const onEffectCreated = cb => emitter.on(EFFECT_CREATED)(cb)
export const onStoreCreated = cb => emitter.on(STORE_CREATED)(cb)

export const isSignal = x => x.of && eq(x.of)(createSignal)
export const isEffect = x => x.of && eq(x.of)(createEffect)
export const isStore = x => x.of && eq(x.of)(createStore)

// Signals

const mapSignal = signal => fn => {
  isSignal(signal) || raiseError('invalid "signal" argument')
  isFunction(fn) || raiseError('invalid "fn" argument, function required')
  const target = signal.of()
  // TODO: unwatch
  signal.watch(x => target(fn(x)))
  return target
}

const filterSignal = signal => fn => {
  isSignal(signal) || raiseError('invalid "signal" argument')
  isFunction(fn) || raiseError('invalid "fn" argument, function required')
  const target = signal.of()
  // TODO: unwatch
  signal.watch(x => (fn(x) && target(x)))
  return target
}

const forwardSignalToStore = signal => (store, reduce) => {
  isSignal(signal) || raiseError('invalid "signal" argument')
  isStore(store) || raiseError('invalid "store" argument')
  isFunction(reduce) || raiseError('invalid "reduce" argument, function required')
  return store.on(signal, reduce)
}

export const createSignal = () => {
  const id = K(ID())
  const inspect = K(`signal(${id()})`)

  /** @instance */
  const signal = payload => emitter.emit(inspect())(payload)
  signal.of = createSignal
  signal.id = id
  signal.inspect = inspect
  signal.watch = handler => emitter.on(inspect())(handler)
  signal.map = mapSignal(signal)
  signal.filter = filterSignal(signal)
  signal.toStore = forwardSignalToStore(signal)

  emitter.emit(SIGNAL_CREATED)(signal)
  return signal
}

// Effect

export const createEffectState = effect => {
  isEffect(effect) || raiseError('invalid "effect" argument')
  const store = createStore(false)
  store.on(effect.exec, K(true))
  store.reset(effect.fail)
  store.reset(effect.done)
  return store
}

export const createEffect = fn => {
  isFunction(fn) || raiseError('invalid "fn" argument, function required')

  const id = K(ID())
  const inspect = K(`effect(${id()})`)

  const exec = createSignal()
  const done = createSignal()
  const fail = createSignal()

  /** @instance */
  const effect = payload => exec(payload)
  effect.of = createEffect
  effect.id = id
  effect.inspect = inspect
  effect.exec = exec
  effect.done = done
  effect.fail = fail

  // TODO: unwatch
  exec.watch(payload => {
    Promise.resolve(fn(payload)).then(done).catch(fail)
  })

  emitter.emit(EFFECT_CREATED)(effect)
  return effect
}

// Store

const mapStore = store => fn => {
  isStore(store) || raiseError('invalid "store" argument')
  isFunction(fn) || raiseError('invalid "fn" argument, function required')
  const changed = createSignal()
  const target = store.of(fn(store()))
  target.on(changed, (_, payload) => fn(payload))
  // TODO: unwatch
  store.watch(changed)
  return target
}

export const createStore = initial => {
  const id = K(ID())
  const inspect = K(`store(${id()})`)

  const state = new Map()
  const getInitialState = () => state.get('initial')
  const setInitialState = xx => state.set('initial', xx)
  const getCurrentState = () => state.get('current')
  const setCurrentState = xx => state.set('current', xx)

  const changed = createSignal()

  const updateState = compose(changed, getCurrentState, setCurrentState)
  const compareStates = (curr, next) => not(equal(curr)(next))

  const store = () => getCurrentState()
  store.of = createStore
  store.id = id
  store.inspect = inspect
  store.map = mapStore(store)
  store.watch = changed.watch

  store.on = (signal, reduce) => {
    isSignal(signal) || raiseError('invalid "signal" argument')
    isFunction(reduce) || raiseError('invalid "reduce" argument, function required')
    const handler = payload => {
      const curr = getCurrentState()
      const next = reduce(curr, payload)
      compareStates(curr, next) && updateState(next)
    }
    return signal.watch(handler)
  }

  store.reset = (signal) => {
    isSignal(signal) || raiseError('invalid "signal" argument')
    const handler = () => {
      const curr = getCurrentState()
      const next = getInitialState()
      compareStates(curr, next) && updateState(next)
    }
    return signal.watch(handler)
  }

  store.getState = getCurrentState

  setInitialState(initial)
  compareStates(getCurrentState(), getInitialState()) && updateState(initial)

  emitter.emit(STORE_CREATED)(store)
  return store
}

export const combineStores = (...stores) => fn => {
  isFunction(fn) || raiseError('invalid "fn" argument, function required')
  const changed = createSignal()
  const store = createStore()
  store.on(changed, (_, payload) => payload)

  // TODO: unwatchs
  map(store => {
    return store.watch(() => {
      const args = map(x => x())(stores)
      const payload = apply(fn)(args)
      changed(payload)
    })
  })(stores)

  return store
}
