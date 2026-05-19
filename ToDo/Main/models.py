from django.db import models

# Create your models here.

class To_do(models.Model):
    Titulo = models.CharField(max_length=250, blank=False)  #blank establece que el campo puede o no estár vacío
    Descripcion = models.TextField(blank=True)
    Fecha = models.DateField(blank=False)
    Completado = models.BooleanField(default=False) #blank = False establecerá la tarea como 'No completada'
    DuracionPomodoro = models.IntegerField(default=25)
    PomodorosCompletados = models.IntegerField(default=0)
    PomodorosEsperados = models.IntegerField(default=1)

    def __str__(self):
        return self.Titulo