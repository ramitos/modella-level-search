var async = require('async')
var type = require('type-component')

var search = function(index, Model){
  if(!(this instanceof search)) return new search(index, Model)

  var self = this
  this.index = index
  this.Model = Model

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

search.prototype.onAttr = function(name, options){
  if(!options.search){
    return
  }

  this.attrs.push(name)
}

search.prototype.remove = function(model, fn){
  var self = this

  function unlink(err){
    if(err) return fn(err)
    self.index.remove(model.primary(), fn)
  }

  this._save.call(model, unlink)
}

search.prototype.save = function(model, fn){
  var self = this

  function index(err){
    if(err) return fn(err)
    self.index.link(self.attrs.map(function(attr){
      return model[attr]()
    }).join(' '), model.primary(), self.Model.modelName, fn)
  }

  this._save.call(model, index)
}

search.prototype.search = function(query, fn){
  var self = this
  var facet = self.Model.modelName

  self.index.search(query, facet, function(err, result){
    if(err) return fn(err)
    async.map(result.results, function(id, fn){
      self.Model.get(id, fn)
    }, function(err, results){
      if(err) return fn(err)
      result.results = results
      fn(err, result)
    })
  })
}

module.exports = function(index){
  return function(Model){
    var instance = search(index, Model)
    Model.search = instance.search.bind(instance)
  }
}