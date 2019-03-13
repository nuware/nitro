# Nitro

## Install

```bash
npm install @nuware/nitro --save
```

or

```html
<script defer src="https://unpkg.com/@nuware/nitro@latest/dist/nitro.umd.js"></script>
```

or

```html
<script defer src="https://unpkg.com/@nuware/nitro@latest/dist/nitro.umd.min.js"></script>
```


## Usage

Browser

```javascript
const { createSignal, createStore, combineStores } = window.nuware.Nitro
```

Node

```javascript
const { createSignal, createStore, combineStores } = require('@nuware/nitro')
```

or

```javascript
import { createSignal, createStore, combineStores } from '@nuware/nitro'
```

## Exmaple

```javascript
const setUser = createSignal()
const deleteUser = createSignal()
const deleteAllUsers = createSignal()

const users = createStore({})
users.reset(deleteAllUsers)
users.on(setUser, (state, payload) => {
  const { id, data } = payload
  return assoc(id)(data)(state)
})
users.on(deleteUser, (state, id) => {
  return dissoc(id)(state)
})

const usersCount = users.map((state) => {
  return keys(state).length
})

const onEmptyUsers = usersCount.map((state) => {
  return (state === 0)
})

users.watch((state) => console.log('Users:', state))
usersCount.watch((count) => console.log('Total Users:', count))
onEmptyUsers.watch(isEmpty => isEmpty && console.log('Users is empty!'))

const u1 = {
  id: 'id1',
  data: {
    name: 'User One'
  }
}

const u2 = {
  id: 'id2',
  data: {
    name: 'User Two'
  }
}

setUser(u1)
setUser(u2)

deleteUser(u1.id)
deleteAllUsers()
```

## License

MIT License

## Author

Dmitry Dudin <dima@nuware.ru>
