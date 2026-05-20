#Aquí se define el Serializador (Convertir instancias de modelos en formato JSON o XML)

from rest_framework import serializers
from .models import To_do   #Serializamos el modelo To_do

class To_Do_Serializer(serializers.ModelSerializer):
    class Meta:
        model = To_do
        fields = ['id','Titulo','Descripcion','Fecha','Completado', 'DuracionPomodoro', 'PomodorosCompletados', 'PomodorosEsperados', 'Apuntes']
        #En fields se puede excluir atributos específicos de la serialización