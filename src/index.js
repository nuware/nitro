/* global crypto */

import {
  apply,
  compose,
  dissoc,
  each,
  equal,
  isFunction,
  map,
  not
} from '@nuware/functions'

import {
  Prop,
  Get,
  Set,
  Over
} from '@nuware/lenses'

import Emitter from '@nuware/emitter'

const ID_GENERATOR_ALPHABET = 'abcdef0123456789'

const generateId = (size = 16) => {
  const width = ID_GENERATOR_ALPHABET.length - 1
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  return bytes.reduce((a, b) => {
    return a + ID_GENERATOR_ALPHABET.charAt(b & width)
  }, '')
}

// Signals

const mapSignal = parent => fn => {
  const signal = createSignal()
  parent.watch(x => signal(fn(x)))
  return signal
}

const filterSignal = parent => fn => {
  const signal = createSignal()
  parent.watch(x => (fn(x) && signal(x)))
  return signal
}

const createSignal = () => {
  const emitter = Emitter()
  const id = generateId()

  function signal (payload) {
    return emitter.emit('do')(payload)
  }
  signal.id = () => id
  signal.watch = handler => emitter.on('do')(handler)
  signal.map = mapSignal(signal)
  signal.filter = filterSignal(signal)
  return signal
}

// Store

const mapStore = parent => fn => {
  const parentChanged = createSignal()
  const store = createStore(fn(parent()))
  store.on(parentChanged, (_, payload) => fn(payload))
  parent.watch(parentChanged)
  return store
}

const createStore = (initial) => {
  let state = { event: {}, reset: {} }

  const InitialLens = Prop('initial')
  const getInitial = () => Get(InitialLens)(state)
  const setInitial = xx => Set(InitialLens)(xx)(state)
  state = setInitial(initial)

  const CurrentLens = Prop('current')
  const getCurrent = () => Get(CurrentLens)(state)
  const setCurrent = xx => Set(CurrentLens)(xx)(state)
  state = setCurrent(getInitial())

  const createUnsubscriptionLens = (type, signal) => compose(apply(compose), map(Prop))([type, signal.id()])

  const addUnsubscription = type => signal => fn => {
    const Lens = createUnsubscriptionLens(type, signal)
    state = Set(Lens)(fn)(state)
  }
  const addResetUnsubscription = addUnsubscription('reset')
  const addEventUnsubscription = addUnsubscription('event')

  const removeUnsubscription = type => signal => {
    const Lens = createUnsubscriptionLens(type, signal)
    const fn = Get(Lens)(state)
    state = Over(Prop(type))(dissoc(signal.id()))(state)
    isFunction(fn) && fn()
  }
  const removeResetUnsubscription = removeUnsubscription('reset')
  const removeEventUnsubscription = removeUnsubscription('event')

  const hasUnsubscription = type => signal => {
    const Lens = createUnsubscriptionLens(type, signal)
    const fn = Get(Lens)(state)
    return isFunction(fn)
  }
  const hasResetUnsubscription = hasUnsubscription('reset')
  const hasEventUnsubscription = hasUnsubscription('event')

  const stateChanged = createSignal()

  const id = generateId()

  function store () {
    return getCurrent()
  }

  store.id = () => id

  store.reset = signal => {
    if (hasResetUnsubscription(signal)) {
      throw new Error(`store.reset(), signal with id = ${signal.id()} already listen`)
    }

    const unsubscribe = signal.watch(() => {
      const payload = getInitial()
      state = setCurrent(payload)
      stateChanged(payload)
    })

    addResetUnsubscription(signal)(unsubscribe)
    return store
  }

  store.on = (signal, reducer) => {
    if (hasEventUnsubscription(signal)) {
      throw new Error(`store.on(), signal with id = ${signal.id()} already listen`)
    }

    const unsubscribe = signal.watch(payload => {
      const curr = store()
      const next = reducer(curr, payload)
      if (not(equal(curr)(next))) {
        state = setCurrent(next)
        stateChanged(payload)
      }
    })

    addEventUnsubscription(signal)(unsubscribe)
    return store
  }

  store.off = signal => {
    removeEventUnsubscription(signal)
    removeResetUnsubscription(signal)
    return store
  }

  store.watch = handler => {
    const fn = payload => handler(store(), payload)
    return stateChanged.watch(fn)
  }

  store.getState = getCurrent
  store.map = mapStore(store)
  return store
}

const combine = (...stores) => fn => {
  const storeChanged = createSignal()
  const store = createStore()
  store.on(storeChanged, (state, payload) => payload)

  each(store => {
    store.watch(() => {
      const args = map(x => x())(stores)
      const payload = apply(fn)(args)
      storeChanged(payload)
    })
  })(stores)

  return store
}

export {
  createSignal,
  createStore,
  combine
}
