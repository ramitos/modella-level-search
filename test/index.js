var search = process.env.RELATIONS_COV ? require('../lib-cov/search') : require('../')
var inverted = require('inverted-index')
var model = require('modella')
var store = require('level-modella')
var timehat = require('timehat')
var sublevel = require('sublevel')
var async = require('async')

var level = require('level')(__dirname + '/dbs/db-' + timehat())
var index = inverted(sublevel(level, 'search'))

var User = model('user')
User.attr('id')
User.attr('name', { search: true })
User.attr('email', { search: true })
User.use(store(sublevel(level, 'users')))
User.use(search(index))

var Brand = model('brand')
Brand.attr('id')
Brand.attr('name', { search: true })
Brand.use(store(sublevel(level, 'brands')))
Brand.use(search(index))

var brands = require('./brands.json')
var users = require('./users.json')

async.parallel({
  brands: function(fn){
    async.map(Object.keys(brands), function(id, fn){
      brands[id].id = id
      debugger
      Brand(brands[id]).save(fn)
    }, fn)
  },
  users: function(fn){
    async.map(Object.keys(users), function(id, fn){
      users[id].id = id
      debugger
      User(users[id]).save(fn)
    }, fn)
  }
}, function(err){
  if(err) throw err
  User.search('Jo', function(err, result){
    if(err) throw err
    console.log(JSON.stringify(result))
  })
})