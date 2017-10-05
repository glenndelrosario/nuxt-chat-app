import Vue from 'vue'

export const state = () => ({
  users: [],
  conversations: {},
  currentConversationId: null,
  recipientUserID: null,
  fetched: false
})

export const getters = {
  currentConversation (state) {
    return state.currentConversationId ? state.conversations[state.currentConversationId] : null
  },
  recipientUser (state) {
    return state.users ? state.users.find(x => x.id === state.recipientUserID) : null
  }
}

export const mutations = {
  SET_FETCHED: function (state) {
    state.fetched = true
  },
  SET_USERS: function (state, users) {
    state.users = users
  },
  SET_CONVERSATIONS: function (state, conversations) {
    conversations.forEach(conversation => {
      createConversation(state, conversation, this.$socket)
    })
  },
  ADD_CONVERSATION: function (state, conversation) {
    createConversation(state, conversation, this.$socket)
  },
  SWITCH_CONVERSATION: function (state, id) {
    state.currentConversationId = id
  },
  SET_RECIPIENT_USER_ID: function (state, id) {
    state.recipientUserID = id
  },
  SET_MESSAGES: function (state, payload) {
    const conversation = state.conversations[payload.conversationId]

    Vue.set(conversation, 'messages', payload.messages)
    Vue.set(conversation, 'fetched', true)
  },
  PUSH_MESSAGE: function (state, message) {
    state.conversations[message.conversationId].messages.push(message)
  }
}

export const actions = {
  async fetchUsers ({ state, commit }, endpoint = '/users') {
    const users = await this.$axios.$get(endpoint)
    commit('SET_USERS', users)
  },

  async fetchConversations ({ state, commit }, endpoint = '/conversations') {
    const conversations = await this.$axios.$get(endpoint)
    commit('SET_CONVERSATIONS', conversations)
  },

  actionAfterLoggedin ({ state, dispatch, commit }) {
    if (state.fetched === false) {
      // state.fetched = true
      commit('SET_FETCHED')
      dispatch('fetchUsers')
      dispatch('fetchConversations')
    }
  },

  async switchConversation ({ state, commit }, recipientUserID) {
    let conversationId = Object.keys(state.conversations).find(id => state.conversations[id].participants.includes(recipientUserID))

    if (conversationId) {
      // Fetch messages if not already fetched
      commit('SWITCH_CONVERSATION', conversationId)

      let conversation = state.conversations[conversationId]

      // Check if messages is fetched already
      if (conversation.fetched === false) {
        const { data } = await this.$axios.get(`conversation\\${conversationId}`)

        commit('SET_MESSAGES', {
          conversationId: conversationId,
          messages: data
        })
      }
    } else {
      // create new conversation
      let conversation = await this.$axios.post('conversation', {
        recipient: recipientUserID
      })

      commit('ADD_CONVERSATION', conversation)
      commit('SWITCH_CONVERSATION', conversation._id)
    }

    commit('SET_RECIPIENT_USER_ID', recipientUserID)
  },

  pushMessage ({ commit }, message) {
    commit('PUSH_MESSAGE', message)
  },

  async sendMessage ({ state, dispatch }, message, endpoint = `send-message/${state.currentConversationId}`) {
    const { data } = await this.$axios.post(endpoint, {
      body: message
    })

    if (data) {
      await dispatch('pushMessage', data)
      this.$socket.emit('send-message', data)
    }
  }
}

const createConversation = (state, conversation, socket) => {
  conversation.messages = []
  conversation.isRead = true
  conversation.fetched = false

  Vue.set(state.conversations, conversation._id, conversation)

  if (socket) {
    socket.emit('enter-conversation', conversation._id)
  }
}
