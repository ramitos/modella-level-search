var async = require('async')
var type = require('type-component')
var sublevel = require('sublevel')
var inverted = require('inverted-index')


var Model = function(model, index){
  if(!(this instanceof Model)) return new search(model, index)

  this.Model = model
  this.index = index

  this.attrs = Object.keys(Model.attrs).filter(function(attr){
    return Model.attrs[attr].search
  })

  this._save = Model.prototype.save
  this._remove = Model.prototype.remove

  Model.prototype.save = function(fn){
    if(type(fn) !== 'function') fn = function(){}
    self.save(this, fn)
  }

  Model.prototype.remove = function(fn){
    if(type(fn) !== 'function') fn = function(){}
    self.remove(this, fn)
  }

  Model.on('attr', this.onAttr.bind(this))
}

Model.prototype.onAttr = function(name, options){
  if(!options.Model){
    return
  }

  this.attrs.push(name)
}

Model.prototype.remove = function(model, fn){
  var self = this

  function unlink(err){
    if(err) return fn(err)
    self.index.remove(model.primary(), fn)
  }

  this._save.call(model, unlink)
}

Model.prototype.save = function(model, fn){
  var self = this
  var facet = self.Model.modelName
  var id = model.primary() + '--' + facet

  function index(err){
    if(err) return fn(err)
    self.index.link(self.attrs.map(function(attr){
      return model[attr]()
    }).join(' '), id, facet, fn)
  }

  this._save.call(model, index)
}

Model.prototype.search = function(query, fn){
  var self = this
  var facet = self.Model.modelName

  self.index.search(query, facet, function(err, result){
    if(err) return fn(err)
    async.map(result.results, function(id, fn){
      self.Model.get(id.replace(/--.*?$/i, ''), fn)
    }, function(err, results){
      if(err) return fn(err)
      result.results = results
      fn(err, result)
    })
  })
}

var search = module.exports = function(Model, db, options){
  if(!(this instanceof search)) return new search(Model, db, options)

  this.index = inverted(sublevel(db, 'search'), options)
  this.models = {}
}

search.prototype.addModel = function(model){
  return this.models[model.modelName] = Model(model, this.index)
}

search.prototype.search = function(query, options, fn){
  var self = this

  if(options !== 'object'){
    fn = options
    options = {}
  }

  self.index.search(query, options, function(err, result){
    if(err) return next(err);

    async.map(result.results, function(id, fn){
      var modelName = id.match(/--(.*?)$/i)[1]
      self.models[modelName].Model.get(id.replace(/--(.*?)$/i, ''), fn)
    }, function(err, results){
      if(err) return fn(err)
      fn(err, {
        last: result.last,
        results: results
      })
    })
  })
}

search.prototype.plugin = function(Model){
  var instance = this.addModel(Model)
  Model.search = instance.search.bind(instance)
}